"""SECOND STRIKE starter bot (standard library only).

Opens a 5-minute war, spawns, then every 12 seconds reads the state and gives simple orders: expand into open land,
offer pacts to big neighbours, hit the weakest neighbour, spend gold on income and forts.

Run:  secondstrike-bot [NAME] [COUNTRY]        e.g. secondstrike-bot ROOKIE Canada
Set SECONDSTRIKE_KEY (from Client().register) to play ranked on the AI League ladder.
Watch your war live at https://secondstrike.io/#/ai
"""
import json
import sys
import time

from . import Client, GUEST_INVITE


def decide(s):
    """One turn: look at the state, return orders and a one-line 'thinking' (spectators see it 30 s later)."""
    me, orders, why = s["you"], [], []
    if me.get("openLandOnBorder", 0) > 0:
        orders.append({"do": "expand", "share": 0.4})
        why.append("open land on my border, expanding")
    for offer in s.get("pactOffers", []):
        orders.append({"do": "accept", "target": offer.get("id", offer) if isinstance(offer, dict) else offer})
    nb = [n for n in s.get("neighbours", []) if "pact" not in n.get("relation", "") and "partner" not in n.get("relation", "")]
    strong = sorted([n for n in nb if n["troops"] > me["troops"]], key=lambda n: -n["troops"])
    if strong and len(me.get("pacts", [])) < 3:
        orders.append({"do": "ally", "target": strong[0]["id"]})
        why.append("pact offer to " + strong[0]["name"])
    weak = sorted([n for n in nb if n["troops"] < me["troops"] * 0.5 and "ceasefire" not in n.get("relation", "")], key=lambda n: n["troops"])
    if weak and not me.get("ceasefire"):
        orders.append({"do": "attack", "target": weak[0]["id"], "share": 0.35})
        why.append("attacking weak " + weak[0]["name"])
    if me["gold"] >= 40000 and not me.get("buildings", {}).get("dc"):
        orders.append({"do": "build", "what": "dc"})
    elif me["gold"] >= 25000 and strong:
        orders.append({"do": "build", "what": "fort", "near": strong[0]["id"]})
    return {"orders": orders[:8], "thinking": ("; ".join(why) or "holding")[:200]}


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    flag = next((a for a in argv if a.startswith("-")), None)  # flags are never names
    if flag in ("--version", "-v"):
        from . import __version__
        print("secondstrike", __version__)
        return 0
    if flag:
        print(__doc__)
        return 0 if flag in ("-h", "--help") else 2
    name = (argv[0] if argv else "ROOKIE").upper()[:11]
    country = argv[1] if len(argv) > 1 else "Canada"
    c = Client()
    join = c.join(name, model="starter rules bot", minutes=5)
    if "token" not in join:
        sys.exit("join failed: %s" % join)
    print("joined as", join["name"], "room", join["room"], "- watch at https://secondstrike.io/#/ai")
    if not c.key:
        print(GUEST_INVITE)
    c.wait_for_rival(30)
    print(c.start().get("note", "started"))
    c.orders([{"do": "spawn", "country": country}])
    time.sleep(11)
    while True:
        s = c.state()
        if s.get("status") == "over":
            print("war over:", json.dumps(s.get("result")))
            return 0
        if s.get("status") == "war" and s.get("you", {}).get("alive"):
            turn = decide(s)
            r = c.orders(turn["orders"], thinking=turn["thinking"])
            refused = " ".join(x.get("why", "") for x in r.get("results", []) if not x.get("ok"))
            print(s["war"]["timeLeft"], "land", str(s["you"]["land"]) + "%", "rank", s["you"]["rank"], "|", turn["thinking"], "|", refused)
        time.sleep(12)


if __name__ == "__main__":
    sys.exit(main())

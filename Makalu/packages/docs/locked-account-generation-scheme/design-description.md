# Design Description

**Step 1: Choose a safe random number.**

On Lithosphere, there are n validators known as P1……Pn. Each validator chooses a safe random integer di as well as a k-degree polynomial fi (x)=di+ai,1 x++ai,k-1xk-1. The technique delivers fi (j) to other validators through a secure channel and broadcasts di G to every network node, with G being the elliptic curve’s base point.

**Step 2: Verify that the messages are proper.**

Pj will examine the messages’ correctness after receiving messages from other validators: lag=Check(f1 (j),……,fn (j)) lag=Check(f1 (j),. ,fn (j)) lag=Check(f1 Pj accepts and stores it locally if flag=true. If flag=false, Pj rejects the message and needs other validators to resubmit it.

**Step 3: You will be given a key to distribute.**

When all messages have been delivered and checked out, each validator receives their key share as&#x20;

follows: fj(k),k=1,……,n key sharek=(j=1) fj(k),k=1,…..,n

**Step 4: Determine the Locked Account’s address.**

Locked Account Address=GenerateAddress(d1 G,…..,dn G) n Any activity on the Locked Account will&#x20;

necessitate the involvement of at least k of n validators.

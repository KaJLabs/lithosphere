# Introduction

Distributed cryptography’s theoretical foundation and a basic challenge of distributed computing are both secure multi-party computation.

The hypothesis is based on the 1982 book “Yao’s Millionaires’ Problem.” Simply defined, secure multi-party computing refers to a set of players known as P1 Pn who collaborate to safely calculate the function f(x1, xn )=(y1, yn). Then each of the n participants has one of the function f inputs. Pi has the secret input xi and receives the output yi after calculation. In this case, security necessitates ensuring the validity of the computing result, even if some individuals cheat throughout the computation process. This implies that after the computations are finished, each participant must receive the right result yi, and all participant input is protected. Through the calculation, Pi can obtain no further information other than (xi,yi).


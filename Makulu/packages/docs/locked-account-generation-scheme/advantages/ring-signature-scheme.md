# Ring Signature Scheme

In 2001, the Ring Signature method was introduced. It’s a type of Group Signature scheme that’s a little different. A trusted centre and secure setup are required for a Group Signature scheme, which means that the signer may be tracked by the trust centre. By eliminating the trusted hub and securing the system, the Ring Signature method overcomes this major problem.

Since the introduction of the Ring Signature method, numerous practical systems based on Elliptic Curve Cryptography (ECC), such as the trapdoor approach, have been developed. Trapdoor Ring Signature, Linkable Ring Signature, Anonymity Revocable Ring Signature, and Deniable Ring Signature are the four types of Ring Signature systems.

The Ring Signature method based on ECC is developed in Lithosphere to offer anonymity in Smart Contract Token transfers.

The Ring Signature scheme is divided into three sections. The following are the details, using the signer (P,x) as an example:

Get the public parameters using GEN. The signer uses the method GeneratePublicKeySet( ) with the public key as a parameter to build a public key set with n members from the global state: publickeyset=GeneratePublicKeySet(P) I=GenerateKeyImage((P,x))=I=GenerateKeyImage((P,x))=I=GenerateKeyImage((P,x))=I=GenerateK eyImage((P,x))=I=GenerateKeyImage((P,x))=I=GenerateKeyImage((P,x))=I

RING SIGNATURE: Create the ring signature. The signer uses GenerateRingSignature( ) to produce the ring&#x20;

signature for message m, using public keyset, I, and x: ringsig=GenerateRingSignature(m,public keyset,I,x) VERIFY THE RING SIGNIFICANCE VerifyRingSignature( ), which returns true or false with public keyset, I, and rings: lag=VerifyRingSignature validates the ring signature of message m. (m,publickeyset,I,ringsig)

The ring signature is valid if the flag is true. Otherwise, it is void.

The key picture and ring signature in the Ring Signature scheme cannot be matched with a signer from the public key set. Anyone can check whether or not a signature is genuine, but no one can identify the signer.

####

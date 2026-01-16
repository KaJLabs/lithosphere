# Scheme Generation

The private key is never produced or reconstructed throughout the whole network during the Locked Account creation procedure. The involvement of at least k validators is required to generate the signature of the Locked Account. They compute signature shares independently using the key shares they own and then use signature shares to reconstruct the complete signature. The Signature Scheme for Locked Accounts is as follows:

Calculate the Signature Shares in Step 1 Using key shares, several n Lithosphere Validators compute signature shares of the message.

**Step 2**: Distribute the signatures.

Each Validator transmits his or her signature share to the others.

**Step 3**: Reassemble and broadcast the whole signature.

When a Validator gets more than k signature shares, it reconstructs the signature in its entirety and broadcasts it to other Validators:

signature=Construct Sig(signature share1,. ,signature sharek)

**Step 4:** They produce the Locked Account’s complete signature, which includes the following information: signature sharej=Generate Sig(m,key sharej)

# General Nodes

The threshold key sharing method is intended to address the issue of secure key management. The security of cryptography is dependent on the security of the keys, according to contemporary cryptography design principles. Cryptography’s security will be jeopardized if secure keys are compromised. As a result, key management is critical in cryptography security research and design. It might be challenging to handle the distribution of keys safely when an account is maintained by numerous persons with diverse interests. Cryptographer Adi Shamir devised the Shamir’s Secret Sharing threshold key sharing technique to tackle this problem.

A key is split into n pieces and handed to n participants in this system. Each participant has a piece of the key share, and the key must be reconstructed using a minimum of k key shares. As a result, each activity on an account will need the cooperation of at least k individuals to maintain the account’s security and reliability.

Based on safe multi-party computation and threshold key sharing, we created the Locked Account creation technique. Lithosphere Validators (Record-keepers) are in charge of maintaining and managing the keys to the Locked Accounts to guarantee that they are secure and reliable. Furthermore, in an ad-hoc network with no set topology, this technique reduces the danger of keys being lost and offers high flexibility and stability.

The following is the Locked Account Generation Scheme:

{% content-ref url="design-description.md" %}
[design-description.md](design-description.md)
{% endcontent-ref %}

{% content-ref url="scheme-generation.md" %}
[scheme-generation.md](scheme-generation.md)
{% endcontent-ref %}

{% content-ref url="advantages/" %}
[advantages](advantages/)
{% endcontent-ref %}

\

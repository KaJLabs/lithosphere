"""Executable immutable R8 authorization action and subject dispatcher."""
from __future__ import annotations
import hmac
from dataclasses import dataclass
@dataclass(frozen=True)
class Rule:
    payload_type:int;domain_id:int;authority:str
R={
 (0x0001,1):Rule(0x0004,0x0002,"ordinary"),(0x0001,2):Rule(0x0005,0x0003,"ordinary"),
 (0x0001,3):Rule(0x001d,0x0017,"fee-payer-ordinary"),
 (0x0002,1):Rule(0x0010,0x0004,"ordinary+proposed"),(0x0002,2):Rule(0x0011,0x0005,"ordinary+proposed"),
 (0x0002,3):Rule(0x0012,0x0006,"ordinary-or-recovery"),(0x0002,4):Rule(0x0013,0x0007,"recovery"),
 (0x0002,5):Rule(0x0014,0x0008,"recovery+proposed"),(0x0002,6):Rule(0x0017,0x000d,"permissionless-mature-trigger"),
 (0x0004,1):Rule(0x0020,0x000c,"governance"),(0x0004,2):Rule(0x0020,0x000c,"governance"),
 (0x0004,3):Rule(0x0020,0x000c,"governance"),(0x0004,4):Rule(0x0020,0x000c,"pq-registry-emergency-2-of-3-slh-dsa"),
 (0x0005,1):Rule(0x0035,0x0012,"bridge-ordinary"),
 (0x0006,1):Rule(0x0100,0x0030,"build-ordinary"),(0x0006,2):Rule(0x0101,0x0031,"compiler-ordinary"),
 (0x0006,3):Rule(0x0102,0x0032,"auditor-ordinary"),(0x0006,4):Rule(0x0103,0x0033,"deployment-ordinary"),
 (0x0006,5):Rule(0x0115,0x0038,"governance+completed-issuer-key-transition"),(0x0006,6):Rule(0x0112,0x0036,"log-ordinary"),
}
B={
 (0x0001,1):(1,"principal"),(0x0001,2):(1,"principal"),(0x0001,3):(1,"principal"),
 (0x0002,1):(None,"operation"),(0x0002,2):(None,"operation"),(0x0002,3):(None,"operation"),(0x0002,4):(None,"operation"),(0x0002,5):(None,"operation"),
 (0x0004,1):(4,"registered"),(0x0004,2):(4,"registered"),(0x0004,3):(4,"registered"),(0x0004,4):(4,"registered"),
 (0x0005,1):(5,"registered"),(0x0006,1):(6,"registered"),(0x0006,2):(6,"registered"),(0x0006,3):(6,"registered"),(0x0006,4):(6,"registered"),(0x0006,5):(4,"registered"),(0x0006,6):(6,"registered"),
}
def dispatch(namespace:int,action:int,payload_type:int,domain_id:int,*,subject_kind:int,signing_subject:bytes,bound_subject_kind:int,bound_subject:bytes,principal_namespace:int|None=None,inner_action:int|None=None,target_type:int|None=None,emergency:bool|None=None)->Rule:
    rule=R.get((namespace,action))
    if rule is None or (payload_type,domain_id)!=(rule.payload_type,rule.domain_id):raise ValueError("unregistered or mismatched authorization action")
    binding=B.get((namespace,action))
    expected_length=20 if subject_kind in (1,3) else 32
    if binding is None or subject_kind not in range(1,7) or (binding[0] is not None and subject_kind!=binding[0]) or bound_subject_kind!=subject_kind or len(signing_subject)!=expected_length or len(bound_subject)!=expected_length or not hmac.compare_digest(signing_subject,bound_subject):raise ValueError("subject/action binding mismatch")
    if binding[1]=="principal" and principal_namespace not in (1,2):raise ValueError("subject/action principal mismatch")
    if namespace==0x0004:
        if inner_action!=action:raise ValueError("governance inner/outer action mismatch")
        if emergency!=(action==4):raise ValueError("governance emergency flag mismatch")
        if target_type not in range(1,6) or (action==4 and target_type!=2):raise ValueError("governance target mismatch")
    return rule
def bind_registry_governance(*,action:int,governance_sequence:int,signing_sequence:int,mutation_governance_sequence:int,governance_activation_height:int,mutation_activation_height:int,commit_height:int,consensus_height:int,emergency:bool)->None:
    if governance_sequence!=signing_sequence or governance_sequence!=mutation_governance_sequence:raise ValueError("registry governance sequence mismatch")
    if governance_activation_height!=mutation_activation_height:raise ValueError("registry activation height mismatch")
    if commit_height!=consensus_height:raise ValueError("registry commit height mismatch")
    if action not in (3,4) or emergency!=(action==4):raise ValueError("registry governance action mismatch")
def bind_provenance_mutation(*,mutation_governance_sequence:int,signing_sequence:int,transition_commit_height:int,consensus_height:int)->None:
    if mutation_governance_sequence!=signing_sequence:raise ValueError("provenance governance sequence mismatch")
    if transition_commit_height!=consensus_height:raise ValueError("provenance commit height mismatch")
def self_test():
    for (namespace,action),rule in R.items():
        if (namespace,action)==(0x0002,6):
            try:dispatch(namespace,action,rule.payload_type,rule.domain_id,subject_kind=1,signing_subject=b"a"*20,bound_subject_kind=1,bound_subject=b"a"*20)
            except ValueError:pass
            else:raise AssertionError("permissionless activation accepted as signed authorization")
            continue
        subject_kind=B[(namespace,action)][0] or ((action%6)+1);identity=bytes([action])*(20 if subject_kind in (1,3) else 32)
        binding={"subject_kind":subject_kind,"signing_subject":identity,"bound_subject_kind":subject_kind,"bound_subject":identity,"principal_namespace":1 if B[(namespace,action)][1]=="principal" else None}
        kwargs={"inner_action":action,"target_type":2 if action==4 else 1,"emergency":action==4} if namespace==0x0004 else {}
        assert dispatch(namespace,action,rule.payload_type,rule.domain_id,**binding,**kwargs)==rule
        for wrong in ((rule.payload_type^1,rule.domain_id),(rule.payload_type,rule.domain_id^1)):
            try:dispatch(namespace,action,*wrong,**binding,**kwargs)
            except ValueError:pass
            else:raise AssertionError("mismatch accepted")
    emergency_id=bytes([4])*32
    assert dispatch(0x0004,4,0x0020,0x000c,subject_kind=4,signing_subject=emergency_id,bound_subject_kind=4,bound_subject=emergency_id,inner_action=4,target_type=2,emergency=True).authority=="pq-registry-emergency-2-of-3-slh-dsa"
    for bad in ({"inner_action":3,"target_type":2,"emergency":True},{"inner_action":4,"target_type":1,"emergency":True},{"inner_action":4,"target_type":2,"emergency":False}):
        try:dispatch(0x0004,4,0x0020,0x000c,subject_kind=4,signing_subject=emergency_id,bound_subject_kind=4,bound_subject=emergency_id,**bad)
        except ValueError:pass
        else:raise AssertionError("bad emergency governance dispatch accepted")
    try:dispatch(0x0001,1,0x0004,0x0002,subject_kind=1,signing_subject=b"a"*20,bound_subject_kind=1,bound_subject=b"b"*20,principal_namespace=1)
    except ValueError:pass
    else:raise AssertionError("cross-subject transfer accepted")
    bind_registry_governance(action=3,governance_sequence=7,signing_sequence=7,mutation_governance_sequence=7,governance_activation_height=100,mutation_activation_height=100,commit_height=10,consensus_height=10,emergency=False)
    for field,value in (("signing_sequence",8),("mutation_governance_sequence",8),("mutation_activation_height",101),("consensus_height",11)):
        args=dict(action=3,governance_sequence=7,signing_sequence=7,mutation_governance_sequence=7,governance_activation_height=100,mutation_activation_height=100,commit_height=10,consensus_height=10,emergency=False);args[field]=value
        try:bind_registry_governance(**args)
        except ValueError:pass
        else:raise AssertionError(f"registry binding mismatch accepted: {field}")
    bind_provenance_mutation(mutation_governance_sequence=9,signing_sequence=9,transition_commit_height=11,consensus_height=11)
    for key in ((0xffff,1),(0x0003,1),(0x0005,2)):
        try:dispatch(*key,1,1,subject_kind=1,signing_subject=b"a"*20,bound_subject_kind=1,bound_subject=b"a"*20)
        except ValueError:pass
        else:raise AssertionError("unknown action accepted")
    print(f"authorization dispatcher verified {len(R)} immutable action rows and mismatch rejection")
if __name__=="__main__":self_test()

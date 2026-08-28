"""Executable R4 transparency inclusion proof reference."""
from __future__ import annotations
from transparency_consistency_v1 import leaf,node,root,split
def inclusion_proof(index:int,leaves:list[bytes])->list[tuple[int,bytes]]:
    if index<0 or index>=len(leaves):raise ValueError("leaf index")
    if len(leaves)==1:return []
    k=split(len(leaves))
    if index<k:return inclusion_proof(index,leaves[:k])+[(2,root(leaves[k:]))]
    return inclusion_proof(index-k,leaves[k:])+[(1,root(leaves[:k]))]
def orientations(index:int,size:int)->list[int]:
    if size==1:return []
    k=split(size)
    if index<k:return orientations(index,k)+[2]
    return orientations(index-k,size-k)+[1]
def verify(index:int,size:int,envelope_commitment:bytes,expected_root:bytes,proof:list[tuple[int,bytes]])->bool:
    if size<1 or index<0 or index>=size or len(envelope_commitment)!=64:return False
    expected=orientations(index,size)
    if len(proof)!=len(expected) or len(proof)>64:return False
    value=leaf(envelope_commitment)
    for (side,sibling),want in zip(proof,expected):
        if side!=want or len(sibling)!=64:return False
        value=node(sibling,value) if side==1 else node(value,sibling)
    return value==expected_root
def self_test():
    sizes=[1,2,3,4,5,7,8,9,15,16,17,31,32,33,63,64,65,127,128,129,255,256,257,512,1000,1024]
    all_values=[i.to_bytes(64,"big") for i in range(1,1025)]
    all_leaves=[leaf(x) for x in all_values]
    for size in sizes:
        expected=root(all_leaves[:size])
        for index in range(size):
            proof=inclusion_proof(index,all_leaves[:size])
            if not verify(index,size,all_values[index],expected,proof):raise AssertionError((size,index))
            if proof:
                bad=proof.copy();bad[0]=(1 if proof[0][0]==2 else 2,proof[0][1])
                if verify(index,size,all_values[index],expected,bad):raise AssertionError("orientation accepted")
    print("transparency inclusion verified for every index across boundary sizes through 1024")
if __name__=="__main__":self_test()

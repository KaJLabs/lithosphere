"""Executable R3 transparency-root and prefix-consistency reference."""
from __future__ import annotations
import hashlib

def h(tag:str,data:bytes=b"")->bytes:return hashlib.sha3_512(tag.encode("ascii")+b"\0"+data).digest()
EMPTY=h("LITHO_LOG_EMPTY_V1")
def leaf(value:bytes)->bytes:
    if len(value)!=64:raise ValueError("envelope commitment must be 64 bytes")
    return h("LITHO_LOG_LEAF_V1",value)
def node(left:bytes,right:bytes)->bytes:
    if len(left)!=64 or len(right)!=64:raise ValueError("node inputs must be 64 bytes")
    return h("LITHO_LOG_NODE_V1",left+right)
def split(n:int)->int:return 1<<(n-1).bit_length()-1 if n>1 else 0
def root(leaves:list[bytes])->bytes:
    if not leaves:return EMPTY
    if len(leaves)==1:return leaves[0]
    k=split(len(leaves));return node(root(leaves[:k]),root(leaves[k:]))
def consistency_proof(old:int,leaves:list[bytes])->list[bytes]:
    if old<0 or old>len(leaves):raise ValueError("tree sizes")
    if old==0 or old==len(leaves):return []
    def sub(m:int,items:list[bytes],complete:bool)->list[bytes]:
        if m==len(items):return [] if complete else [root(items)]
        k=split(len(items))
        if m<=k:return sub(m,items[:k],complete)+[root(items[k:])]
        return sub(m-k,items[k:],False)+[root(items[:k])]
    return sub(old,leaves,True)
def verify(old_size:int,new_size:int,old_root:bytes,new_root:bytes,proof:list[bytes])->bool:
    if any(len(x)!=64 for x in proof) or len(proof)>64 or old_size>new_size:return False
    if old_size==0:return not proof and old_root==EMPTY
    if old_size==new_size:return not proof and old_root==new_root
    if not proof:return False
    fn=old_size-1;sn=new_size-1
    while fn&1:fn>>=1;sn>>=1
    if fn==0:fr=sr=old_root;remaining=proof
    else:fr=sr=proof[0];remaining=proof[1:]
    for c in remaining:
        if fn&1 or fn==sn:
            fr=node(c,fr);sr=node(c,sr)
            while fn!=0 and not fn&1:fn>>=1;sn>>=1
        else:sr=node(sr,c)
        fn>>=1;sn>>=1
    return sn==0 and fr==old_root and sr==new_root
def self_test()->None:
    leaves=[leaf(i.to_bytes(64,"big")) for i in range(1,65)]
    for new in range(1,65):
        for old in range(0,new+1):
            proof=consistency_proof(old,leaves[:new])
            if not verify(old,new,root(leaves[:old]),root(leaves[:new]),proof):raise AssertionError((old,new))
            if proof:
                bad=proof.copy();bad[0]=bytes(64)
                if verify(old,new,root(leaves[:old]),root(leaves[:new]),bad):raise AssertionError("corruption accepted")
    print("transparency consistency verified for all prefixes through 64 leaves")
if __name__=="__main__":self_test()

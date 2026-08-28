"""Independent Python emergency algorithm-successor verifier."""
import copy,json
from pathlib import Path
V=Path(__file__).resolve().parents[1]/"vectors"/"emergency_authority_upgrade.json"
def run(initial,case):
 s=copy.deepcopy(initial);accepted=[];errors=[]
 for op in case["operations"]:
  if op["type"]=="upgrade":
   if not s["successor_present"]:ok,error=False,"SUCCESSOR_ALREADY_CONSUMED"
   elif op["height"]!=s["activation_height"]:ok,error=False,"WRONG_ACTIVATION_HEIGHT"
   elif op["commitment"]!=s["successor_commitment"]:ok,error=False,"SUCCESSOR_COMMITMENT_MISMATCH"
   elif op.get("registry_root")!=s["registry_root"]:ok,error=False,"CRYPTO_REGISTRY_ROOT_MISMATCH"
   elif s["successor_profile_state"]!="ACTIVE":ok,error=False,"SUCCESSOR_PROFILE_NOT_ACTIVE"
   elif s["scheduled_state"] in {"DEPRECATED","DISABLED"} and s["scheduled_height"]<=op["height"]:ok,error=False,"SUCCESSOR_PROFILE_TRANSITION_CONFLICT"
   else:s["active_profile"]=s["successor_profile"];s["successor_present"]=False;ok,error=True,"OK"
  elif op["type"]=="authorize":ok=op["profile"]==s["active_profile"];error="OK" if ok else "WRONG_ACTIVE_PROFILE"
  elif op["type"]=="historical":ok=op["height"]<s["activation_height"] and op["profile"]==initial["active_profile"];error="OK" if ok else "HISTORICAL_PROFILE_MISMATCH"
  else:raise AssertionError(op["type"])
  accepted.append(ok);errors.append(error)
 return {"accepted":accepted,"errors":errors,"active_profile":s["active_profile"],"successor_present":s["successor_present"]}
def main():
 v=json.loads(V.read_text());
 for case in v["cases"]:
  actual=run({**v["initial"],**case.get("initial_override",{})},case)
  if actual!=case["expected"]:raise SystemExit(f"emergency upgrade mismatch: {case['name']}\n{actual}")
 print(f"python emergency authority upgrade verified {len(v['cases'])} cases")
if __name__=="__main__":main()

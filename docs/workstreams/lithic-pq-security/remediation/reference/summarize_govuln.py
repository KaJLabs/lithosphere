"""Mechanically classify govulncheck JSON-stream findings by trace precision."""
from __future__ import annotations
import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"evidence"/"dependency"/"govulncheck-source.json"
OUTPUT=ROOT/"evidence"/"dependency"/"govulncheck-classification.json"
def objects(text:str):
    decoder=json.JSONDecoder();cursor=0
    while cursor<len(text):
        while cursor<len(text) and text[cursor].isspace():cursor+=1
        if cursor==len(text):break
        value,cursor=decoder.raw_decode(text,cursor);yield value
counts=Counter();ids={"symbol_reachable":set(),"package_imported":set(),"module_present":set()}
for item in objects(SOURCE.read_text(encoding="utf-8")):
    finding=item.get("finding")
    if not finding:continue
    trace=finding.get("trace") or [];leaf=trace[-1] if trace else {}
    if leaf.get("function"):kind="symbol_reachable"
    elif leaf.get("package"):kind="package_imported"
    else:kind="module_present"
    counts[kind]+=1;ids[kind].add(finding.get("osv","UNKNOWN"))
ordered_counts={kind:counts[kind] for kind in ("symbol_reachable","package_imported","module_present")}
result={"source":"govulncheck-source.json","classification_rule":{"symbol_reachable":"trace leaf contains function","package_imported":"trace leaf contains package but no function","module_present":"trace leaf contains module but no package/function"},"finding_records":sum(counts.values()),"counts":ordered_counts,"unique_osv_ids":{k:sorted(v) for k,v in ids.items()},"gate":"BLOCKED_PENDING_APPLICABILITY_REVIEW_AND_RESCAN"}
OUTPUT.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result["counts"],sort_keys=True))

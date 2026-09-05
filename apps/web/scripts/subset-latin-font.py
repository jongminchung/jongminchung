"""Regenerate the Latin subset; run manually with pinned fonttools[woff]."""

import base64
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen

from fontTools import subset

web_root = Path(__file__).resolve().parent.parent
manifest_path = web_root / "font-assets.json"
manifest = json.loads(manifest_path.read_text())
asset = manifest["pretendardLatin"]
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
# Retain the original copyright and license in the derived font.
options.name_IDs = ["*"]
with urlopen(asset["sourceUrl"], timeout=30) as response:
    source = response.read()
if hashlib.sha256(source).hexdigest() != asset["sourceSha256Hex"]:
    raise ValueError("Official Pretendard source checksum mismatch")
font = subset.load_font(io.BytesIO(source), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=subset.parse_unicodes(asset["unicodes"]))
subsetter.subset(font)

# Pretendard is a Reserved Font Name; the derived face has its own family name.
names = {
    1: "Jamie Latin",
    3: "JamieLatin-1.0",
    4: "Jamie Latin",
    6: "JamieLatin",
    16: "Jamie Latin",
    25: "JamieLatin",
}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())

destination = web_root / asset["path"]
subset.save_font(font, str(destination), options)
data = destination.read_bytes()
asset["bytes"] = len(data)
asset["sha256Base64"] = base64.b64encode(hashlib.sha256(data).digest()).decode()
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Generated {destination.relative_to(web_root)} ({len(data)} bytes)")

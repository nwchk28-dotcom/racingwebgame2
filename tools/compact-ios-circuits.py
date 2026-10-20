"""Keep the web payload small while retaining sub-millimetre geometry precision."""
import json
from pathlib import Path

def compact(value):
    if isinstance(value, float):
        return round(value, 7)
    if isinstance(value, list):
        return [compact(x) for x in value]
    if isinstance(value, dict):
        return {k: compact(v) for k, v in value.items()}
    return value

for path in (Path(__file__).resolve().parents[1] / 'src/nativeCircuits').glob('*.json'):
    data = json.loads(path.read_text())
    data = {k: data[k] for k in ['id', 'length', 'startYaw', 'curbWidth', 'points', 'normals', 'distances', 'widths', 'surface', 'obstacles', 'corridor']}
    data['corridor'] = {k: v for k, v in data['corridor'].items() if k in ['left', 'right', 'barriers', 'escapeAreas']}
    path.write_text(json.dumps(compact(data), separators=(',', ':')))

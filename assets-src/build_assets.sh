#!/usr/bin/env bash
# 환경이 3D 에셋을 처음부터 다시 만든다.
#
# 준비물
#   - Blender 4.5 (앱) 또는 bpy 4.5 파이썬 모듈
#   - 파이썬 Pillow (얼굴·배지 텍스처 생성용): pip install pillow
#   - Node.js (GLB 압축용 glTF-Transform, npx로 자동 실행)
#
# 사용
#   Blender 앱:   BLENDER="blender" ./assets-src/build_assets.sh
#   bpy 모듈:     BPY="python3" ./assets-src/build_assets.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$HERE/build"
PUBLIC="$ROOT/frontend/public"
mkdir -p "$OUT/tex" "$OUT/opt" "$PUBLIC/models" "$PUBLIC/textures"

run_blender() {
  local script="$1"; shift
  if [[ -n "${BLENDER:-}" ]]; then
    "$BLENDER" -b --factory-startup -P "$HERE/blender/$script" -- "$@"
  else
    "${BPY:-python3}" "$HERE/blender/$script" "$@"
  fi
}

echo "1/5 텍스처 (얼굴 표정·배지·도토리 무늬)"
python3 "$HERE/blender/make_textures.py" "$OUT/tex"

echo "2/5 캐릭터 모델"
run_blender build_character.py "$OUT/tex" "$OUT"

echo "3/5 뼈대·동작 → hwangyeongi.glb"
run_blender rig_and_export.py "$OUT"

echo "4/5 마을 에셋 → village.glb"
run_blender build_village.py "$OUT"

echo "5/5 압축 후 frontend/public 에 복사"
for name in hwangyeongi village; do
  npx --yes @gltf-transform/cli@4 optimize "$OUT/$name.glb" "$OUT/opt/$name.glb" \
    --compress meshopt --texture-compress webp \
    --simplify false --join false --flatten false --instance false --palette false
  cp "$OUT/opt/$name.glb" "$PUBLIC/models/$name.glb"
done
python3 - "$OUT/tex" "$PUBLIC/textures" <<'PY'
import glob, os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for f in glob.glob(os.path.join(src, 'face_*.png')):
    out = os.path.join(dst, os.path.basename(f)[:-4] + '.webp')
    Image.open(f).save(out, 'WEBP', quality=90, method=6)
    print('  ', out)
PY
echo "완료: frontend/public/models, frontend/public/textures"

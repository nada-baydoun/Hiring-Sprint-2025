import os
import json
from uuid import uuid4
from typing import List, Literal, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import numpy as np
from PIL import Image
from ultralytics import YOLO
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.applications.efficientnet import preprocess_input as eff_preprocess

# =========================
# 1) CONFIG
# =========================

YOLO_WEIGHTS_PATH = "yolo11-seg-car-damage.pt"          # put .pt here
SEVERITY_MODEL_PATH = "severity_efficientnetb0_kaggle.h5"  # put .h5 here

IMG_SIZE = (224, 224)
SEVERITY_CLASSES = ["minor", "moderate", "severe"]

# =========================
# 2) FASTAPI APP
# =========================

app = FastAPI(title="Vehicle Damage AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# 3) LOAD MODELS ONCE
# =========================

print("Loading YOLO model...")
yolo_model = YOLO(YOLO_WEIGHTS_PATH)

print("Loading severity model...")
severity_model = keras.models.load_model(SEVERITY_MODEL_PATH)

print("Models loaded.")


# =========================
# 4) SCHEMAS
# =========================

class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Damage(BaseModel):
    id: str
    imageType: Literal["before", "after"]
    area: str
    type: str
    severity: str
    bbox: BBox


class AnalyzeResponse(BaseModel):
    inspectionId: str
    damages: List[Damage]
    message: Optional[str] = None


# =========================
# 5) HELPERS (from Colab)
# =========================

def load_image(path: str) -> Image.Image:
    img = Image.open(path).convert("RGB")
    return img


def crop_patch(pil_img: Image.Image, box_xyxy):
    x1, y1, x2, y2 = box_xyxy
    crop = pil_img.crop((x1, y1, x2, y2))
    crop = crop.resize(IMG_SIZE)
    arr = np.array(crop, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)
    arr = eff_preprocess(arr)
    return arr


def predict_severity(patch_tensor):
    preds = severity_model.predict(patch_tensor, verbose=0)[0]
    idx = int(np.argmax(preds))
    label = SEVERITY_CLASSES[idx]
    conf = float(preds[idx])
    return label, conf


def run_yolo_on_image(image_path: str, image_type: str):
    pil_img = load_image(image_path)
    results = yolo_model(image_path)[0]

    h, w = results.orig_shape  # (height, width)
    damages = []

    for i, box in enumerate(results.boxes):
        xyxy = box.xyxy[0].cpu().numpy()
        x1, y1, x2, y2 = xyxy

        patch_tensor = crop_patch(pil_img, (x1, y1, x2, y2))
        severity_label, severity_conf = predict_severity(patch_tensor)

        cls_id = int(box.cls[0])
        raw_type_name = results.names.get(cls_id, f"class_{cls_id}")
        damage_type_label = raw_type_name.strip().title()

        area_label = "Unknown area"

        bbox_norm = {
            "x": float(x1 / w),
            "y": float(y1 / h),
            "width": float((x2 - x1) / w),
            "height": float((y2 - y1) / h),
        }

        damages.append(
            Damage(
                id=f"{image_type}-{i}",
                imageType=image_type,
                area=area_label,
                type=damage_type_label,
                severity=severity_label,
                bbox=BBox(**bbox_norm),
            )
        )

    return damages


def analyze_pair(before_path: str, after_path: str) -> AnalyzeResponse:
    before_damages = run_yolo_on_image(before_path, "before")
    after_damages = run_yolo_on_image(after_path, "after")

    all_damages = before_damages + after_damages

    # Decide message based on detections
    if len(before_damages) == 0 and len(after_damages) == 0:
        message = "No damage detected in either image."
    elif len(before_damages) == 0 and len(after_damages) > 0:
        message = "No damage detected in BEFORE image."
    elif len(before_damages) > 0 and len(after_damages) == 0:
        message = "No damage detected in AFTER image."
    else:
        message = "Damage detected successfully."

    return AnalyzeResponse(
        inspectionId="AUTO-DEMO-001",
        damages=all_damages,
        message=message,
    )





# =========================
# 6) API ENDPOINT
# =========================

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(
    before: UploadFile = File(...),
    after: UploadFile = File(...),
):
    """
    Accepts 'before' and 'after' image files and returns
    YOLO + severity analysis.
    """
    try:
        tmp_dir = "/tmp"
        os.makedirs(tmp_dir, exist_ok=True)

        before_suffix = os.path.splitext(before.filename or "")[1] or ".jpg"
        after_suffix = os.path.splitext(after.filename or "")[1] or ".jpg"

        before_path = os.path.join(tmp_dir, f"before_{uuid4().hex}{before_suffix}")
        after_path = os.path.join(tmp_dir, f"after_{uuid4().hex}{after_suffix}")

        with open(before_path, "wb") as bf:
            bf.write(await before.read())

        with open(after_path, "wb") as af:
            af.write(await after.read())

        result = analyze_pair(before_path, after_path)

    except Exception as e:
        print("Error in /analyze:", e)
        raise HTTPException(status_code=500, detail="AI analysis failed.")
    finally:
        for p in [locals().get("before_path"), locals().get("after_path")]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    return result


@app.get("/")
def root():
    return {"status": "ok", "message": "Vehicle Damage AI API"}

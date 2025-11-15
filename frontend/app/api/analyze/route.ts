import { NextRequest, NextResponse } from "next/server";

const AI_BACKEND_URL = "http://127.0.0.1:8000/analyze";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const beforeFile = formData.get("before");
    const afterFile = formData.get("after");

    if (!(beforeFile instanceof File) || !(afterFile instanceof File)) {
      return NextResponse.json(
        { error: "Both 'before' and 'after' images are required." },
        { status: 400 }
      );
    }

    // Build a FormData to send to the Python backend
    const backendForm = new FormData();
    backendForm.append("before", beforeFile, beforeFile.name || "before.jpg");
    backendForm.append("after", afterFile, afterFile.name || "after.jpg");

    const backendRes = await fetch(AI_BACKEND_URL, {
      method: "POST",
      body: backendForm,
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => "");
      console.error("AI backend error:", backendRes.status, errText);
      return NextResponse.json(
        { error: "AI analysis failed." },
        { status: 502 }
      );
    }

    const data = await backendRes.json();

    // Pass through AI JSON directly to the frontend
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in /api/analyze:", err);
    return NextResponse.json(
      { error: "Failed to run analysis." },
      { status: 500 }
    );
  }
}

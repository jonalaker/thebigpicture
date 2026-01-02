import { NextResponse } from "next/server";
import axios from "axios";
import FormData from "form-data";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const data = new FormData();
    data.append("file", buffer, file.name);

    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
          ...data.getHeaders(),
        },
        maxBodyLength: Infinity,
      }
    );

    return NextResponse.json({
      cid: res.data.IpfsHash,
    });
  } catch (err) {
    console.error("IPFS upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

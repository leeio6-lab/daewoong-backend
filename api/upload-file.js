// Vercel Serverless Function - File Upload
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, requestId, requestType } = req.body;

    if (!file || !requestId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Supabase 클라이언트 초기화
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Base64 디코딩
    const base64Data = file.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // 파일 확장자 추출
    const mimeType = file.split(';')[0].split(':')[1];
    const extension = mimeType.split('/')[1];
    const fileName = `${requestType}/${requestId}_${Date.now()}.${extension}`;

    // Supabase Storage에 업로드
    const bucket = requestType === 'account_request' 
      ? 'account-documents' 
      : 'io-documents';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      throw error;
    }

    // 공개 URL 생성
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return res.status(201).json({
      success: true,
      data: {
        fileName: fileName,
        fileUrl: urlData.publicUrl,
        requestId: requestId
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Upload failed'
    });
  }
}

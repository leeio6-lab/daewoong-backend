  1	// Vercel Serverless Function - 파일 업로드
     2	// 경로: /api/upload-file
     3	
     4	const { createClient } = require('@supabase/supabase-js');
     5	const formidable = require('formidable');
     6	const fs = require('fs');
     7	
     8	// Vercel에서 bodyParser 비활성화
     9	module.exports.config = {
    10	  api: {
    11	    bodyParser: false,
    12	  },
    13	};
    14	
    15	module.exports = async (req, res) => {
    16	  // CORS 헤더 설정
    17	  res.setHeader('Access-Control-Allow-Origin', '*');
    18	  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    19	  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    20	
    21	  // CORS preflight
    22	  if (req.method === 'OPTIONS') {
    23	    return res.status(200).end();
    24	  }
    25	
    26	  if (req.method !== 'POST') {
    27	    return res.status(405).json({ error: 'Method not allowed' });
    28	  }
    29	
    30	  try {
    31	    // Supabase 클라이언트 초기화 (SUPABASE_KEY 사용)
    32	    const supabase = createClient(
    33	      process.env.SUPABASE_URL,
    34	      process.env.SUPABASE_KEY
    35	    );
    36	
    37	    // 폼 데이터 파싱
    38	    const form = formidable({ multiples: true });
    39	    
    40	    const { fields, files } = await new Promise((resolve, reject) => {
    41	      form.parse(req, (err, fields, files) => {
    42	        if (err) reject(err);
    43	        resolve({ fields, files });
    44	      });
    45	    });
    46	
    47	    const file = files.file;
    48	    const requestId = Array.isArray(fields.requestId) ? fields.requestId[0] : fields.requestId;
    49	    const requestType = Array.isArray(fields.requestType) ? fields.requestType[0] : fields.requestType;
    50	
    51	    if (!file) {
    52	      return res.status(400).json({ 
    53	        success: false,
    54	        error: '파일이 없습니다.' 
    55	      });
    56	    }
    57	
    58	    // 파일 읽기
    59	    const fileBuffer = fs.readFileSync(file.filepath);
    60	    const fileName = `${Date.now()}-${file.originalFilename}`;
    61	    const bucketName = requestType === 'account_request' ? 'account-documents' : 'io-documents';
    62	
    63	    // Supabase Storage에 업로드
    64	    const { data, error } = await supabase.storage
    65	      .from(bucketName)
    66	      .upload(`${requestId}/${fileName}`, fileBuffer, {
    67	        contentType: file.mimetype,
    68	        upsert: false
    69	      });
    70	
    71	    if (error) {
    72	      throw new Error(`업로드 실패: ${error.message}`);
    73	    }
    74	
    75	    // 공개 URL 생성
    76	    const { data: publicUrlData } = supabase.storage
    77	      .from(bucketName)
    78	      .getPublicUrl(data.path);
    79	
    80	    // 임시 파일 삭제
    81	    try {
    82	      fs.unlinkSync(file.filepath);
    83	    } catch (e) {
    84	      console.warn('임시 파일 삭제 실패:', e);
    85	    }
    86	
    87	    return res.status(200).json({
    88	      success: true,
    89	      data: {
    90	        fileName: file.originalFilename,
    91	        filePath: data.path,
    92	        fileUrl: publicUrlData.publicUrl,
    93	        fileSize: file.size,
    94	        mimeType: file.mimetype,
    95	        requestId: requestId
    96	      }
    97	    });
    98	
    99	  } catch (error) {
   100	    console.error('파일 업로드 오류:', error);
   101	    return res.status(500).json({
   102	      success: false,
   103	      error: error.message || '파일 업로드 중 오류가 발생했습니다.'
   104	    });
   105	  }
   106	};
   107	

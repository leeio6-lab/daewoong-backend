// Vercel Serverless Function - OCR 처리
// 경로: /api/ocr-process

const Tesseract = require('tesseract.js');

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileUrl, requestId } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: '파일 URL이 없습니다.'
      });
    }

    console.log('OCR 처리 시작:', fileUrl);

    // Tesseract.js로 OCR 처리
    const { data: { text, confidence } } = await Tesseract.recognize(
      fileUrl,
      'kor+eng',
      {
        logger: info => console.log(info)
      }
    );

    console.log('OCR 완료 - 신뢰도:', confidence);
    console.log('추출된 텍스트:', text);

    // 텍스트에서 계좌 정보 추출
    const extractedData = extractBankInfo(text);

    // 신뢰도 체크
    if (confidence < 50 || !extractedData.accountNumber) {
      return res.status(200).json({
        success: false,
        fallbackRequired: true,
        confidence: confidence,
        rawText: text,
        data: extractedData,
        message: 'OCR 신뢰도가 낮거나 계좌번호를 찾을 수 없습니다.'
      });
    }

    return res.status(200).json({
      success: true,
      data: extractedData,
      confidence: confidence,
      rawText: text
    });

  } catch (error) {
    console.error('OCR 처리 오류:', error);
    return res.status(200).json({
      success: false,
      fallbackRequired: true,
      error: error.message || 'OCR 처리 중 오류가 발생했습니다.'
    });
  }
};

// 은행 정보 추출 함수
function extractBankInfo(text) {
  const result = {
    bankName: null,
    accountNumber: null,
    accountHolder: null
  };

  // 은행명 추출
  const bankPatterns = [
    /KB국민은행/,
    /신한은행/,
    /우리은행/,
    /하나은행/,
    /NH농협은행/,
    /IBK기업은행/,
    /국민은행/,
    /카카오뱅크/,
    /토스뱅크/,
    /케이뱅크/,
    /SC제일은행/,
    /한국씨티은행/,
    /부산은행/,
    /대구은행/,
    /경남은행/
  ];

  for (const pattern of bankPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.bankName = match[0];
      break;
    }
  }

  // 계좌번호 추출 (숫자와 하이픈으로 구성, 10~20자리)
  const accountPattern = /[\d\-]{10,20}/g;
  const accountMatches = text.match(accountPattern);
  if (accountMatches && accountMatches.length > 0) {
    // 가장 긴 것을 계좌번호로 간주
    result.accountNumber = accountMatches.sort((a, b) => b.length - a.length)[0];
  }

  // 예금주 추출 (한글 이름, 2~4자)
  const namePattern = /[가-힣]{2,4}/g;
  const nameMatches = text.match(namePattern);
  if (nameMatches && nameMatches.length > 0) {
    // 은행명이 아닌 첫 번째 한글 이름
    result.accountHolder = nameMatches.find(name => 
      !name.includes('은행') && 
      !name.includes('뱅크') &&
      !name.includes('지점') &&
      !name.includes('예금') &&
      !name.includes('계좌')
    );
  }

  return result;
}

import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lyrics } = req.body;

  if (!lyrics) {
    return res.status(400).json({ error: 'No lyrics provided' });
  }

  try {
    // Split lyrics into lines for reference
    const lyricsLines = lyrics.split('\n');

    // Step 1: Identify section boundaries
    const segmentationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a lyrics analyzer. Your task is to identify the different sections of a song (verse 1, verse 2, chorus, bridge, etc.) and return their line ranges. Return ONLY valid JSON in this format: {\"sections\": [{\"type\": \"verse\", \"startLine\": 1, \"endLine\": 4}, ...]}. Line numbers are 1-indexed. Each section should be continuous and not overlap with others."
        },
        {
          role: "user",
          content: `Identify the sections in these numbered lyrics:\n${lyrics.split('\n').map((line: string, i: number) => `[Line ${i + 1}] ${line}`).join('\n')}\n\nReturn the sections with their line number ranges. Make sure line numbers correspond to the numbers shown above.`
        }
      ]
    });
    
    // Clean up the response and parse JSON
    let jsonString = segmentationResponse.choices[0].message.content || '{"sections": []}';
    console.log('Raw Segmentation Result:', jsonString);
    console.log('Number of lines in lyrics:', lyricsLines.length);
    
    // Remove markdown code block markers and any extra whitespace
    jsonString = jsonString.replace(/^```json\s*|\s*```$/g, '').trim();
    
    // Find the first { and last } to extract the JSON object
    const startIndex = jsonString.indexOf('{');
    const endIndex = jsonString.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      jsonString = jsonString.slice(startIndex, endIndex + 1);
    }
    
    console.log('Cleaned Segmentation Result:', jsonString);
    const segmentationResult = JSON.parse(jsonString);

    // Validate and fix line numbers
    const totalLines = lyricsLines.length;
    segmentationResult.sections = segmentationResult.sections
      .map((section: any) => ({
        ...section,
        startLine: Math.max(1, Math.min(section.startLine, totalLines)),
        endLine: Math.max(1, Math.min(section.endLine, totalLines))
      }))
      // Filter out invalid sections where startLine > endLine
      .filter((section: any) => section.startLine <= section.endLine);

    // Step 2: Process each section
    const processedSections = await Promise.all(
      segmentationResult.sections.map(async (section: any) => {
        // Get the section text from the line numbers
        const sectionLines = lyricsLines.slice(section.startLine - 1, section.endLine);
        const sectionText = sectionLines.join('\n');

        const sectionResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a skilled translator and lyrics analyst. Translate the given lyrics section to English, preserving meaning and cultural context. Return ONLY valid JSON in this format: {\"translation\": \"translated text\", \"analysis\": \"analysis text\"}. CRITICAL: Preserve ALL existing line breaks from the original text, and DO NOT add any new ones. Each line in the original should correspond to exactly one line in the translation. The number and position of line breaks must match the original EXACTLY."
            },
            {
              role: "user",
              content: `Translate each line, maintaining EXACT line structure:\n${sectionText}\n\nIMPORTANT: Return one translated line for each original line, keeping all line breaks in the same places.`
            }
          ]
        });

        // Clean up the response and parse JSON
        let sectionJsonString = sectionResponse.choices[0].message.content || '{}';
        sectionJsonString = sectionJsonString.replace(/^```json\s*|\s*```$/g, '').trim();
        
        const sStartIndex = sectionJsonString.indexOf('{');
        const sEndIndex = sectionJsonString.lastIndexOf('}');
        if (sStartIndex !== -1 && sEndIndex !== -1) {
          sectionJsonString = sectionJsonString.slice(sStartIndex, sEndIndex + 1);
        }
        console.log('Section JSON:', sectionJsonString);

        const sectionResult = JSON.parse(sectionJsonString);
        
        // Convert escaped line breaks to actual line breaks and process the translation
        const translationText = sectionResult.translation
          .replace(/\\\\n/g, '\n')  // Convert double-escaped line breaks
          .replace(/\\n/g, '\n')    // Convert single-escaped line breaks
          .replace(/\\/g, '\n')     // Convert double backslashes to line breaks
          .replace(/\r\n/g, '\n')   // Normalize Windows line endings
          .replace(/\r/g, '\n');    // Normalize old Mac line endings
        
        return {
          type: section.type,
          original: sectionText,
          translation: translationText,
          analysis: sectionResult.analysis || ''
        };
      })
    );

    res.status(200).json({ sections: processedSections });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({
      error: 'Failed to translate lyrics',
      details: error.message,
      rawResponse: error.response?.data?.error?.message
    });
  }
}
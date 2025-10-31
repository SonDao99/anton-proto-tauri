import re
from typing import Dict, Optional
from models.citation import Citation, CitationMap
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class CitationExtractor:
    """Extract citations with exact quotes from generated notes"""

    def __init__(self):
        # Pattern to match citation with quote
        # Matches: 1. [cite:file:section]\n   > quote text
        self.cite_with_quote_pattern = re.compile(
            r'(\d+)\.\s*\[cite:([^:]+):([^\]]+)\]\s*\n\s*>\s*(.+?)(?=\n\d+\.\s*\[cite:|\n##|\Z)',
            re.DOTALL
        )
    
    def extract_citations(
        self,
        note_text: str,
        medical_content: Dict[str, str]
    ) -> CitationMap:
        """
        Extract citations with their exact quotes from the References section
        """
        # Find the References section
        references_match = re.search(
            r'## References\s*\n(.*?)(?=\n##|\Z)',
            note_text,
            re.DOTALL
        )

        if not references_match:
            logger.warning("No References section found in note")
            return CitationMap(citations={}, total_count=0)

        references_text = references_match.group(1)
        logger.info(f"References section found, length: {len(references_text)}")

        # Parse citations with quotes
        citations_dict = {}
        matches = self.cite_with_quote_pattern.finditer(references_text)

        for match in matches:
            number = int(match.group(1))
            filename = match.group(2)
            section = match.group(3)
            quote = match.group(4).strip()

            # Clean up the quote (remove > from continuation lines)
            quote_lines = quote.split('\n')
            cleaned_quote = '\n'.join(
                line.strip().lstrip('>').strip()
                for line in quote_lines
            )

            citation_id = f"{filename}:{section}"

            logger.info(f"Extracted citation [{number}]: {filename} - {section}")
            logger.info(f"Quote preview: {cleaned_quote[:100]}...")

            citations_dict[number] = Citation(
                id=citation_id,
                number=number,
                filename=filename,
                section=section,
                content=cleaned_quote,  # Use the LLM's exact quote
                context=f"From {section}",  # Add section as context
                timestamp=self._extract_timestamp(filename)
            )

        logger.info(f"Extracted {len(citations_dict)} citations with quotes")
        return CitationMap(
            citations=citations_dict,
            total_count=len(citations_dict)
        )
    
    def _extract_section_content(
        self, 
        filename: str, 
        section: str, 
        medical_content: Dict[str, str]
    ) -> str:
        """Extract specific section from medical file content"""
        if filename not in medical_content:
            return "Source content not found"
        
        content = medical_content[filename]
        
        # Try to find the section in the content
        section_pattern = rf'{re.escape(section)}[:\n]+(.*?)(?=\n\n|\Z)'
        match = re.search(section_pattern, content, re.IGNORECASE | re.DOTALL)
        
        if match:
            return match.group(1).strip()
        
        # Fallback: return first 500 chars
        return content[:500] + "..." if len(content) > 500 else content
    
    def _extract_timestamp(self, filename: str) -> Optional[datetime]:
        """Extract timestamp from filename if present"""
        timestamp_match = re.search(r'(\d{8})-(\d{2})\.(\d{2})', filename)
        if timestamp_match:
            date_str = timestamp_match.group(1)
            hour = timestamp_match.group(2)
            minute = timestamp_match.group(3)
            
            try:
                return datetime.strptime(
                    f"{date_str}{hour}{minute}", 
                    "%Y%m%d%H%M"
                )
            except ValueError:
                pass
        
        return None

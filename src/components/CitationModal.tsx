import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Citation } from '@/types/ward-round';
import { FileText, Calendar, Quote } from 'lucide-react';

interface CitationModalProps {
  citation: Citation | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CitationModal({ citation, isOpen, onClose }: CitationModalProps) {
  if (!citation) return null;

  // Format timestamp if available
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-base font-semibold px-3 py-1 border rounded">
              [{citation.number}]
            </span>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <DialogTitle className="text-lg font-medium">
                {citation.filename}
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="flex items-center gap-4">
            <span className="font-medium text-foreground">{citation.section}</span>
            {citation.timestamp && (
              <span className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                {formatTimestamp(citation.timestamp)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[500px] overflow-y-auto rounded-lg border p-6">
          {/* Main quoted content */}
          <div className="flex items-start gap-3 mb-4">
            <Quote className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                Cited Text
              </h4>
              <div className="bg-secondary/30 rounded-lg p-4 border-l-4 border-primary">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {citation.content}
                </p>
              </div>
            </div>
          </div>

          {/* Additional context if provided */}
          {citation.context && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Context
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {citation.context}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
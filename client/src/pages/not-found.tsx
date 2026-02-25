import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B0626] flex items-center justify-center px-6 pt-16">
      <div className="text-center">
        <h1 className="font-serif text-6xl text-shadows-text/20 mb-4" data-testid="text-404">404</h1>
        <p className="text-shadows-text/50 text-sm mb-8">This page does not exist in the atlas.</p>
        <Link href="/">
          <Button
            variant="outline"
            className="border-[#350A8C]/30 text-shadows-text/60 no-default-hover-elevate no-default-active-elevate hover:border-[#03FF9B] hover:text-[#03FF9B] transition-all"
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

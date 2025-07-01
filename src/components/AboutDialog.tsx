
import React, { useState } from 'react';
import { Info, Github, Beer, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Declare the injected version variable
declare const __APP_VERSION__: string;

interface AboutDialogProps {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AboutDialog({ trigger, open: controlledOpen, onOpenChange }: AboutDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  // Get version with fallback
  const getVersion = () => {
    try {
      return __APP_VERSION__;
    } catch {
      return "0.0.1"; // Fallback version
    }
  };

  // Handle external links
  const handleExternalLink = (url: string) => {
    if (window.electron?.openExternal) {
      window.electron.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Clone the trigger element and add click handler (only if not controlled)
  const triggerWithClick = !isControlled ? React.cloneElement(trigger as React.ReactElement, {
    onClick: () => setOpen(true),
  }) : trigger;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerWithClick}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img 
              src="/icon.png" 
              alt="PLYNK-IO" 
              className="h-8 w-8"
            />
            <div>
              <div className="text-lg">PLYNK-IO</div>
              <p className="text-sm text-muted-foreground font-normal">Version {getVersion()}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Player Link Input Output - A gloriously overengineered I/O control system for emulated arcade games.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">Hey, I'm Paul — aka CtrlAltPaul 🍺</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                I build wild, occasionally unstable, and often delightful digital experiments — from arcade integrations to memory-hacking tools and chaotic game output systems. I live for projects that blur the line between software and reality (usually involving LEDs, retro games, or deeply unnecessary automation).
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                I do it because I love it — and because I'm often one of the few unhinged enough to try.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Huge thanks to legends like <strong>Boomslangnz</strong>, <strong>MightyMike</strong>, and the many other mad scientists out there reverse-engineering memory maps, cracking open game logic, and making it possible for weirdos like me to light up my Arcade machine like it's a Christmas tree! Your skill and persistence push this whole scene forward — You dug into the memory space and mapped the chaos — I'm just the guy who duct-taped hardware to it.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you've found my code useful, my tools helpful, or my bugs funny, a small contribution helps me keep tinkering, breaking things, and building stuff that makes dev life more fun. Whether it goes toward a case of beer, servers, or a coffee — it keeps the lights blinking and the logs rolling.
              </p>
              <p className="text-sm text-muted-foreground">
                Thanks for being here 👾<br />
                —CtrlAltPaul
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={() => handleExternalLink('https://github.com/ctrl-alt-paul/plynk-io')}
            >
              <Github className="h-4 w-4 mr-2" />
              View on GitHub
              <ExternalLink className="h-3 w-3 ml-auto" />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
              onClick={() => handleExternalLink('https://buymeacoffee.com/ctrl_alt_paul')}
            >
              <Beer className="h-4 w-4 mr-2" />
              Buy me a beer
              <ExternalLink className="h-3 w-3 ml-auto" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

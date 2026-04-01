import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { motion } from 'motion/react';
import { Hash } from 'lucide-react';

export const Login: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 neon-glow">
            <Hash className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">DevNotes</h1>
          <p className="text-muted-foreground">Your futuristic developer workspace. <br/> Sign in to sync your notes across devices.</p>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.2 }}
           className="w-full glass rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          <SignIn 
            appearance={{
              elements: {
                card: "bg-transparent shadow-none border-none",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "bg-white/5 border-white/10 hover:bg-white/10 text-foreground transition-all",
                formButtonPrimary: "bg-primary hover:bg-primary/80 transition-all",
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-primary hover:text-primary/80",
                identityPreviewText: "text-foreground",
                formFieldLabel: "text-muted-foreground text-xs uppercase tracking-widest font-bold",
                formFieldInput: "bg-black/20 border-white/10 text-foreground",
                dividerLine: "bg-white/10",
                dividerText: "text-muted-foreground"
              }
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};

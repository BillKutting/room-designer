import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const SimpleAnimatedBackground = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Simple floating animations
    gsap.to(".floating-orb-1", {
      y: -30,
      x: 20,
      duration: 8,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut"
    });

    gsap.to(".floating-orb-2", {
      y: 25,
      x: -15,
      duration: 10,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
      delay: 2
    });

    gsap.to(".floating-orb-3", {
      y: -20,
      x: -25,
      duration: 12,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
      delay: 4
    });

    // Subtle pulse animations
    gsap.to(".pulse-element", {
      scale: 1.1,
      opacity: 0.6,
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
      stagger: 1
    });

    // Cleanup
    return () => {
      gsap.killTweensOf(".floating-orb-1, .floating-orb-2, .floating-orb-3, .pulse-element");
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d99ff]/10 via-[#1a1a1a] to-[#00d4ff]/10"></div>
      
      {/* Floating Orbs */}
      <div className="floating-orb-1 absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-[#0d99ff]/15 to-[#00d4ff]/15 rounded-full blur-3xl"></div>
      <div className="floating-orb-2 absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-l from-[#00d4ff]/15 to-[#0d99ff]/15 rounded-full blur-3xl"></div>
      <div className="floating-orb-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-br from-[#0d99ff]/10 to-[#00d4ff]/10 rounded-full blur-2xl"></div>
      
      {/* Pulse Elements */}
      <div className="pulse-element absolute top-1/3 right-1/3 w-32 h-32 bg-[#0d99ff]/10 rounded-full blur-xl"></div>
      <div className="pulse-element absolute bottom-1/3 left-1/3 w-40 h-40 bg-[#00d4ff]/10 rounded-full blur-xl"></div>
      
      {/* Subtle Corner Accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-[#0d99ff]/5 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-[#00d4ff]/5 to-transparent rounded-full blur-3xl"></div>
    </div>
  );
};

export default SimpleAnimatedBackground; 
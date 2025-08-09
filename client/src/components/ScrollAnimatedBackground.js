import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

const ScrollAnimatedBackground = () => {
  const containerRef = useRef(null);
  const storyRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const story = storyRef.current;
    
    if (!container || !story) return;

    // Clear any existing ScrollTriggers
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());

    // Create the main timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: story,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      }
    });

    // Phase 1: Initial State - Clean background
    tl.to(".phase-1", {
      opacity: 1,
      duration: 0.5,
      ease: "power2.out"
    });

    // Phase 2: Room Photo Appears
    tl.to(".room-photo", {
      opacity: 1,
      scale: 1,
      duration: 1,
      ease: "back.out(1.7)"
    }, "-=0.3");

    // Phase 3: AI Tools Emerge
    tl.to(".ai-tools", {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power2.out"
    }, "-=0.5");

    // Phase 4: Room Transformation
    tl.to(".room-before", {
      opacity: 0,
      duration: 0.5,
      ease: "power2.in"
    }, "-=0.3");

    tl.to(".room-after", {
      opacity: 1,
      scale: 1,
      duration: 1,
      ease: "back.out(1.7)"
    }, "-=0.5");

    // Phase 5: Celebration Effects
    tl.to(".celebration-particles", {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      stagger: 0.05,
      ease: "back.out(1.7)"
    }, "-=0.3");

    // Add floating animations for continuous movement
    gsap.to(".floating-element", {
      y: -20,
      x: 10,
      rotation: 5,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
      stagger: 0.2
    });

    // Mouse following effect for interactive elements
    let mouseX = 0, mouseY = 0;
    
    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      
      gsap.to(".interactive-element", {
        x: mouseX * 30,
        y: mouseY * 20,
        duration: 0.5,
        ease: "power2.out"
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div ref={storyRef} className="relative w-full h-full">
        
        {/* Phase 1: Initial Clean Background */}
        <div className="phase-1 absolute inset-0 bg-gradient-to-br from-[#0d99ff]/20 via-[#1a1a1a] to-[#00d4ff]/20 opacity-0"></div>
        
        {/* Phase 2: Room Photo */}
        <div className="room-photo absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-48 bg-gradient-to-br from-[#2d2d2d] to-[#3a3a3a] rounded-xl shadow-2xl opacity-0 scale-0.5">
          <div className="w-full h-full bg-gradient-to-br from-[#0d99ff]/10 to-[#00d4ff]/10 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#0d99ff]/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
                <span className="text-[#0d99ff] text-2xl">🏠</span>
              </div>
              <p className="text-white text-sm font-medium">Room Photo</p>
            </div>
          </div>
        </div>
        
        {/* Phase 3: AI Tools */}
        <div className="ai-tools absolute top-1/4 left-1/4 opacity-0 transform translate-y-10">
          <div className="w-16 h-16 bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] rounded-xl shadow-lg flex items-center justify-center">
            <span className="text-white text-2xl">🖌️</span>
          </div>
          <p className="text-white text-xs mt-2 text-center">AI Brush</p>
        </div>
        
        <div className="ai-tools absolute top-1/4 right-1/4 opacity-0 transform translate-y-10">
          <div className="w-16 h-16 bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] rounded-xl shadow-lg flex items-center justify-center">
            <span className="text-white text-2xl">🎯</span>
          </div>
          <p className="text-white text-xs mt-2 text-center">Selection</p>
        </div>
        
        <div className="ai-tools absolute bottom-1/4 left-1/4 opacity-0 transform translate-y-10">
          <div className="w-16 h-16 bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] rounded-xl shadow-lg flex items-center justify-center">
            <span className="text-white text-2xl">✨</span>
          </div>
          <p className="text-white text-xs mt-2 text-center">Magic</p>
        </div>
        
        <div className="ai-tools absolute bottom-1/4 right-1/4 opacity-0 transform translate-y-10">
          <div className="w-16 h-16 bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] rounded-xl shadow-lg flex items-center justify-center">
            <span className="text-white text-2xl">🚀</span>
          </div>
          <p className="text-white text-xs mt-2 text-center">Generate</p>
        </div>
        
        {/* Phase 4: Room Transformation */}
        <div className="room-before absolute top-1/2 left-1/3 transform -translate-x-1/2 -translate-y-1/2 w-48 h-36 bg-gradient-to-br from-[#2d2d2d] to-[#3a3a3a] rounded-xl shadow-xl">
          <div className="w-full h-full bg-gradient-to-br from-[#666]/20 to-[#888]/20 rounded-xl flex items-center justify-center">
            <span className="text-[#666] text-4xl">🏠</span>
          </div>
        </div>
        
        <div className="room-after absolute top-1/2 right-1/3 transform -translate-x-1/2 -translate-y-1/2 w-48 h-36 bg-gradient-to-br from-[#0d99ff]/20 to-[#00d4ff]/20 rounded-xl shadow-xl opacity-0 scale-0.5">
          <div className="w-full h-full bg-gradient-to-br from-[#0d99ff]/30 to-[#00d4ff]/30 rounded-xl flex items-center justify-center">
            <span className="text-white text-4xl">✨</span>
          </div>
        </div>
        
        {/* Phase 5: Celebration Particles */}
        <div className="celebration-particles absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 scale-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] rounded-full"
              style={{
                transform: `rotate(${i * 30}deg) translateY(-40px)`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
        
        {/* Floating Elements for Continuous Animation */}
        <div className="floating-element absolute top-1/4 left-1/4 w-8 h-8 bg-[#0d99ff]/20 rounded-full blur-sm"></div>
        <div className="floating-element absolute top-3/4 right-1/4 w-6 h-6 bg-[#00d4ff]/20 rounded-full blur-sm"></div>
        <div className="floating-element absolute bottom-1/4 left-1/2 w-10 h-10 bg-[#0d99ff]/15 rounded-full blur-sm"></div>
        
        {/* Interactive Elements */}
        <div className="interactive-element absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#0d99ff]/30 rounded-full blur-md"></div>
        
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0d99ff" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.3"/>
            </linearGradient>
          </defs>
          <line x1="25%" y1="25%" x2="75%" y2="25%" stroke="url(#connectionGradient)" strokeWidth="1" opacity="0.3"/>
          <line x1="25%" y1="75%" x2="75%" y2="75%" stroke="url(#connectionGradient)" strokeWidth="1" opacity="0.3"/>
          <line x1="25%" y1="25%" x2="25%" y2="75%" stroke="url(#connectionGradient)" strokeWidth="1" opacity="0.3"/>
          <line x1="75%" y1="25%" x2="75%" y2="75%" stroke="url(#connectionGradient)" strokeWidth="1" opacity="0.3"/>
        </svg>
      </div>
    </div>
  );
};

export default ScrollAnimatedBackground; 
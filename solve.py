#!/usr/bin/env python3
"""
High-accuracy CAPTCHA solver using ddddocr with optimizations
"""

import ddddocr
import cv2
import numpy as np
import sys
import os
import re

class CAPTCHASolver:
    def __init__(self):
        self.ddddocr = ddddocr.DdddOcr(show_ad=False)
        
        # Character corrections based on common OCR errors
        self.corrections = {
            'z': '2',  # Common OCR confusion
        }
    
    def enhance_image(self, image_path):
        """Apply image enhancement for better OCR"""
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # CLAHE for better contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # Slight denoising
        denoised = cv2.medianBlur(enhanced, 3)
        
        return denoised
    
    def solve_multiple_attempts(self, image_path):
        """Try multiple preprocessing approaches"""
        results = []
        
        # Original approach
        try:
            with open(image_path, 'rb') as f:
                image_bytes = f.read()
            result = self.ddddocr.classification(image_bytes)
            results.append(('original', result))
        except:
            pass
        
        # Enhanced preprocessing
        try:
            enhanced = self.enhance_image(image_path)
            _, encoded = cv2.imencode('.png', enhanced)
            result = self.ddddocr.classification(encoded.tobytes())
            results.append(('enhanced', result))
        except:
            pass
        
        # High contrast
        try:
            img = cv2.imread(image_path)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            contrast = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
            _, encoded = cv2.imencode('.png', contrast)
            result = self.ddddocr.classification(encoded.tobytes())
            results.append(('contrast', result))
        except:
            pass
        
        return results
    
    def apply_corrections(self, text):
        """Apply character corrections"""
        corrected = text.lower()
        
        # Apply simple corrections
        for wrong, correct in self.corrections.items():
            corrected = corrected.replace(wrong, correct)
        
        return corrected
    
    def select_best_result(self, results, image_path):
        """Select best result from multiple attempts"""
        if not results:
            return ""
        
        # Apply corrections
        corrected_results = []
        for method, result in results:
            corrected = self.apply_corrections(result)
            corrected_results.append((method, result, corrected))
        
        # Prefer 6-character results
        length_6_results = [(m, r, c) for m, r, c in corrected_results if len(c) == 6]
        
        if length_6_results:
            return length_6_results[0][2]
        
        return corrected_results[0][2] if corrected_results else ""
    
    def solve(self, image_path):
        """Main solving method"""
        try:
            results = self.solve_multiple_attempts(image_path)
            return self.select_best_result(results, image_path)
        except Exception as e:
            return f"Error: {str(e)}"

def main():
    """Command line interface"""
    if len(sys.argv) < 2:
        print("Usage: python solve.py <image1> [image2] [...]")
        print("Example: python solve.py image1.jpg image2.jpg")
        sys.exit(1)
    
    solver = CAPTCHASolver()
    
    for image_path in sys.argv[1:]:
        if not os.path.exists(image_path):
            print(f"{image_path} → Error: File not found")
            continue
        
        result = solver.solve(image_path)
        print(f"{image_path} → {result}")

if __name__ == "__main__":
    main()
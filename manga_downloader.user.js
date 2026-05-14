// ==UserScript==
// @name         Manga Chapter PDF Downloader
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Download manga chapter images and combine them into a PDF
// @author       You
// @match        https://weebcentral.com/chapters/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Create download button
    function createDownloadButton() {
        const button = document.createElement('button');
        button.textContent = 'Download Chapter as PDF';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#45a049';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#4CAF50';
        });

        document.body.appendChild(button);
        return button;
    }

    // Get all chapter images
    function getChapterImages() {
        return Array.from(document.querySelectorAll('img'))
            .filter(img => img.src.includes('/manga/Rebuild-World/'));
    }

    // Convert image to base64
    function getBase64FromUrl(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onload: function(response) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        console.log('Loaded image:', url);
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(response.response);
                },
                onerror: reject
            });
        });
    }

    // Create PDF from images
    async function createPDF(images) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        for (let i = 0; i < images.length; i++) {
            try {
                const base64 = await getBase64FromUrl(images[i]);
                // Create a temporary image to get dimensions
                const img = new window.Image();
                img.src = base64;
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        let imgWidth = img.naturalWidth;
                        let imgHeight = img.naturalHeight;
                        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
                        imgWidth *= ratio;
                        imgHeight *= ratio;
                        if (i > 0) pdf.addPage();
                        try {
                            pdf.addImage(base64, 'PNG', (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2, imgWidth, imgHeight);
                        } catch (e) {
                            // fallback to JPEG if PNG fails
                            pdf.addImage(base64, 'JPEG', (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2, imgWidth, imgHeight);
                        }
                        resolve();
                    };
                    img.onerror = reject;
                });
            } catch (error) {
                console.error(`Error processing image ${i + 1}:`, error);
            }
        }

        return pdf;
    }

    // Main function
    async function downloadChapter() {
        const button = createDownloadButton();
        button.addEventListener('click', async () => {
            try {
                button.disabled = true;
                button.textContent = 'Downloading...';
                
                const images = getChapterImages();
                if (images.length === 0) {
                    alert('No images found on this page!');
                    return;
                }

                const pdf = await createPDF(images);
                const chapterNumber = window.location.pathname.split('/').pop();
                pdf.save(`chapter_${chapterNumber}.pdf`);
                
                button.textContent = 'Download Complete!';
                setTimeout(() => {
                    button.textContent = 'Download Chapter as PDF';
                    button.disabled = false;
                }, 2000);
            } catch (error) {
                console.error('Error:', error);
                button.textContent = 'Error! Try Again';
                button.disabled = false;
            }
        });
    }

    // Start the script
    downloadChapter();
})(); 
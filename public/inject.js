document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            // Find all div elements within this root (including the root if it's a div)
            const elementsToCheck = [
                ...(mutation.target.tagName === 'DIV' ? [mutation.target] : []),
                ...(mutation.target.getElementsByTagName ? mutation.target.getElementsByTagName('div') : [])
            ];

            // Check each element for redaction
            elementsToCheck.forEach(element => {
                if (element.innerText.trim() === '🔒🔒🔒 REDACTED_MESSAGE') {
                    element.innerHTML = '<span class="locked">🔒<div class="redacted"></div></span>';
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
})

function addStyles() {
    // Create a style element
    const style = document.createElement('style');

// Define the CSS
    const css = `  
.locked {  
  display: inline-flex;  
  align-items: center;  
  gap: 4px;  
  padding: 2px 6px;  
  transition: all 0.2s ease;
  cursor: not-allowed;
}  

.locked:hover {    
  opacity: 0.8;  
}  

.redacted {  
  height: 1em;  
  width: 7em;  
  background: linear-gradient(90deg, #ccc 50%, #ddd 50%);  
  background-size: 4px 100%;  
  animation: shimmer 1.5s infinite linear;  
  opacity: 0.5;
}  

@keyframes shimmer {  
  0% { background-position: 0 0; }  
  100% { background-position: 4px 0; }  
}`;

    style.textContent = css;

    document.head.appendChild(style);
}

addStyles();

// document.addEventListener('DOMContentLoaded', () => {
//     const script = document.createElement('script');
//     script.src = '/powerglitch.min.js';
//     script.async = true;
//     script.onload = () => {
//         setInterval(() => {
//             for (let element of Array.from(document.getElementsByClassName('font-copernicus'))) {
//                 if (!element['$glitch']) {
//                     element['$glitch'] = true;
//                     PowerGlitch.glitch(element);
//                 }
//             }
//         }, 100)
//
//
//     };
//     document.head.appendChild(script);
// });

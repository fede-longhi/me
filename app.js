let siteData = {};

// Fetch data once when the app loads
document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            siteData = data;
            // Render the initial page based on the URL hash, or default to 'home'
            renderPage(); 
        })
        .catch(error => console.error("Error loading site data:", error));
});

// Listen for navigation clicks (hash changes in the URL)
window.addEventListener("hashchange", renderPage);

function renderPage() {
    const contentDiv = document.getElementById('app-content');
    // Get the hash without the '#' (e.g., '#projects' becomes 'projects')
    // Default to 'home' if no hash exists
    const page = window.location.hash.substring(1) || 'home'; 

    // Generate the HTML based on the requested page
    let html = '';

    if (page === 'home') {
        html = `<h2>${siteData.home.title}</h2><p>${siteData.home.content}</p>`;
    } 
    else if (page === 'experience') {
        html = `<h2>Experience</h2>`;
        siteData.experience.forEach(exp => {
            html += `<div class="card">
                        <h3>${exp.role} @ ${exp.company}</h3>
                        <p>${exp.description}</p>
                     </div>`;
        });
    } 
    else if (page === 'projects') {
        html = `<h2>Projects</h2>`;
        siteData.projects.forEach(proj => {
            html += `<div class="card">
                        <h3>${proj.name} <small>(${proj.category})</small></h3>
                        <p>${proj.description}</p>
                        <p><strong>Stack:</strong> ${proj.stack.join(', ')}</p>
                     </div>`;
        });
    } 
    else if (page === 'academy') {
        html = `<h2>Academy</h2>`;
        siteData.academy.forEach(post => {
            html += `<div class="card">
                        <h3>${post.title}</h3>
                        <small>${post.date}</small>
                        <p>${post.summary}</p>
                     </div>`;
        });
    }
    else if (page === 'art' || page === 'games') {
        html = `<h2>${page.charAt(0).toUpperCase() + page.slice(1)}</h2>`;
        siteData[page].forEach(item => {
            html += `<div class="card">
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                     </div>`;
        });
    } 
    else {
        html = `<h2>404</h2><p>Page not found.</p>`;
    }

    // Inject the generated HTML into the DOM instantly
    contentDiv.innerHTML = html;
    
    // Update active state in navigation
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${page}`) {
            link.classList.add('active');
        }
    });
}
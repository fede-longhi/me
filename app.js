document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            // Populate the header
            document.getElementById('name').textContent = data.name;
            document.getElementById('title').textContent = data.title;
            document.getElementById('skills').textContent = data.skills.join(', ');
            
            // Render the projects
            const projectsContainer = document.getElementById('projects');
            data.projects.forEach(project => {
                const projectCard = document.createElement('div');
                projectCard.className = 'project-card';
                projectCard.innerHTML = `
                    <h4>${project.name}</h4>
                    <p>${project.description}</p>
                `;
                projectsContainer.appendChild(projectCard);
            });
        })
        .catch(error => console.error("Error loading CV data:", error));
});
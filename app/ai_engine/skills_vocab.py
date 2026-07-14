# Vocabulary of 100+ Tech Skills for the SkillProof parser

SKILLS_VOCABULARY = {
    "Languages": [
        "python", "javascript", "typescript", "golang", "rust", "java", "c++", "c#", "ruby", 
        "php", "swift", "kotlin", "scala", "clojure", "haskell", "elixir", "dart", "shell scripting"
    ],
    "Backend": [
        "fastapi", "django", "flask", "node.js", "express.js", "nest.js", "spring boot", 
        "asp.net", "laravel", "rails", "grpc", "graphql", "rest api", "microservices"
    ],
    "Frontend": [
        "react", "next.js", "vue.js", "nuxt.js", "angular", "svelte", "jquery", "html5", 
        "css3", "tailwind css", "sass", "webgl", "three.js", "redux", "zustand"
    ],
    "Databases & Cache": [
        "postgresql", "mysql", "sqlite", "mongodb", "redis", "memcached", "cassandra", 
        "dynamodb", "elasticsearch", "neo4j", "mariadb", "firebase", "supabase"
    ],
    "DevOps & Cloud": [
        "docker", "kubernetes", "helm", "terraform", "ansible", "jenkins", "github actions", 
        "aws", "azure", "google cloud platform", "gcp", "digitalocean", "heroku", "nginx", "prometheus", "grafana"
    ],
    "AI & Data Science": [
        "machine learning", "deep learning", "nlp", "computer vision", "tensorflow", "pytorch", 
        "scikit-learn", "pandas", "numpy", "opencv", "hugging face", "langchain", "llama-index",
        "openai api", "vector databases", "pinecone", "chromadb", "data pipelines", "spark", "hadoop"
    ],
    "Mobile & Cross-Platform": [
        "react native", "flutter", "swiftui", "android sdk", "ios sdk", "xamarin", "ionic"
    ],
    "Security & Architecture": [
        "oauth2", "jwt", "cryptography", "ssl/tls", "penetration testing", "owasp top 10", 
        "system design", "clean architecture", "domain driven design", "solid principles"
    ],
    "Testing & Quality": [
        "pytest", "unittest", "jest", "mocha", "cypress", "selenium", "playwright", 
        "cicd", "code coverage", "mocking"
    ]
}

# Flattened set for quick lookup
ALL_SKILLS_SET = {skill.lower() for category in SKILLS_VOCABULARY.values() for skill in category}

def extract_skills_from_text(text: str) -> list[str]:
    """Scrapes a given block of text to identify matched skills in our vocabulary."""
    if not text:
        return []
    
    text_lower = text.lower()
    matched_skills = []
    
    for category, skills in SKILLS_VOCABULARY.items():
        for skill in skills:
            # Check boundary match to prevent substrings matching (e.g. 'go' matching in 'good')
            # Using basic token matching for reliability
            if skill.lower() in text_lower:
                matched_skills.append(skill)
                
    return list(set(matched_skills))

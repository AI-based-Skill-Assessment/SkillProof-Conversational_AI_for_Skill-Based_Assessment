# =============================================================================
# app/core/skills_vocab.py
# 100+ tech skills vocabulary for SkillProof OCR extraction
# =============================================================================

SKILLS_VOCABULARY = {
    "Languages": [
        "python", "javascript", "typescript", "golang", "go", "rust", "java",
        "c++", "c#", "ruby", "php", "swift", "kotlin", "scala", "clojure",
        "haskell", "elixir", "dart", "shell scripting", "bash", "r"
    ],
    "Backend": [
        "fastapi", "django", "flask", "node.js", "nodejs", "express.js", "expressjs",
        "nest.js", "nestjs", "spring boot", "asp.net", "laravel", "rails",
        "grpc", "graphql", "rest api", "restapi", "microservices", "websocket"
    ],
    "Frontend": [
        "react", "reactjs", "react.js", "next.js", "nextjs", "vue.js", "vuejs",
        "nuxt.js", "nuxtjs", "angular", "svelte", "jquery", "html5", "html",
        "css3", "css", "tailwind css", "tailwind", "sass", "scss", "webgl",
        "three.js", "redux", "zustand", "bootstrap", "material ui", "chakra ui"
    ],
    "Databases & Cache": [
        "postgresql", "postgres", "mysql", "sqlite", "mongodb", "redis",
        "memcached", "cassandra", "dynamodb", "elasticsearch", "neo4j",
        "mariadb", "firebase", "supabase", "oracle", "mssql"
    ],
    "DevOps & Cloud": [
        "docker", "kubernetes", "helm", "terraform", "ansible", "jenkins",
        "github actions", "aws", "azure", "google cloud platform", "gcp",
        "digitalocean", "heroku", "nginx", "prometheus", "grafana", "ci/cd",
        "cicd", "linux", "git"
    ],
    "AI & Data Science": [
        "machine learning", "deep learning", "nlp", "natural language processing",
        "computer vision", "tensorflow", "pytorch", "scikit-learn", "pandas",
        "numpy", "opencv", "hugging face", "langchain", "llama-index",
        "openai api", "openai", "vector databases", "pinecone", "chromadb",
        "data pipelines", "spark", "hadoop", "data science", "ai", "artificial intelligence",
        "llm", "large language model", "generative ai", "rag"
    ],
    "Mobile & Cross-Platform": [
        "react native", "flutter", "swiftui", "android sdk", "android",
        "ios sdk", "ios", "xamarin", "ionic", "expo"
    ],
    "Security & Architecture": [
        "oauth2", "jwt", "cryptography", "ssl/tls", "penetration testing",
        "owasp top 10", "system design", "clean architecture",
        "domain driven design", "solid principles", "api security"
    ],
    "Testing & Quality": [
        "pytest", "unittest", "jest", "mocha", "cypress", "selenium",
        "playwright", "cicd", "code coverage", "mocking", "tdd",
        "test driven development", "postman"
    ],
    "Data Engineering": [
        "etl", "kafka", "rabbitmq", "airflow", "dbt", "snowflake",
        "bigquery", "data warehouse", "data lake", "power bi", "tableau"
    ]
}

# Flattened set for quick O(1) lookup
ALL_SKILLS_SET = {
    skill.lower()
    for category in SKILLS_VOCABULARY.values()
    for skill in category
}

# Canonical display names — maps lowercase alias → preferred display name
SKILL_CANONICAL = {
    "reactjs": "React",
    "react.js": "React",
    "react": "React",
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "vuejs": "Vue.js",
    "vue.js": "Vue.js",
    "nuxtjs": "Nuxt.js",
    "nuxt.js": "Nuxt.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "expressjs": "Express.js",
    "express.js": "Express.js",
    "nestjs": "NestJS",
    "nest.js": "NestJS",
    "fastapi": "FastAPI",
    "python": "Python",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "golang": "Go",
    "go": "Go",
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "mongodb": "MongoDB",
    "redis": "Redis",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "aws": "AWS",
    "azure": "Azure",
    "gcp": "Google Cloud Platform",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "flutter": "Flutter",
    "android": "Android",
    "ios": "iOS",
    "html": "HTML5",
    "html5": "HTML5",
    "css": "CSS3",
    "css3": "CSS3",
    "django": "Django",
    "flask": "Flask",
    "angular": "Angular",
    "svelte": "Svelte",
    "mysql": "MySQL",
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "ai": "AI/ML",
    "artificial intelligence": "AI/ML",
    "nlp": "NLP",
    "computer vision": "Computer Vision",
    "openai": "OpenAI API",
    "openai api": "OpenAI API",
    "langchain": "LangChain",
    "react native": "React Native",
    "tailwind css": "Tailwind CSS",
    "tailwind": "Tailwind CSS",
    "git": "Git",
    "linux": "Linux",
    "java": "Java",
    "spring boot": "Spring Boot",
    "llm": "LLM",
    "generative ai": "Generative AI",
    "rag": "RAG",
}


def extract_skills_from_text(text: str) -> list[str]:
    """
    Scan a block of text and return canonical skill names found.
    Uses word-boundary matching to avoid false positives like 'go' in 'good'.
    """
    if not text:
        return []

    text_lower = text.lower()
    matched = set()

    # Sort by length descending so longer matches (e.g. "machine learning") win
    all_skills_sorted = sorted(ALL_SKILLS_SET, key=len, reverse=True)

    for skill in all_skills_sorted:
        # Use simple boundary check: space/start/end/punctuation around skill
        import re
        pattern = r'(?<![a-zA-Z0-9])' + re.escape(skill) + r'(?![a-zA-Z0-9])'
        if re.search(pattern, text_lower):
            canonical = SKILL_CANONICAL.get(skill, skill.title())
            matched.add(canonical)

    return sorted(matched)


def normalize_skill(raw: str) -> str:
    """Return canonical display name for a raw skill string."""
    return SKILL_CANONICAL.get(raw.strip().lower(), raw.strip().title())

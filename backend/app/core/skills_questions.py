# =============================================================================
# app/core/skills_questions.py
# Rule-Based Question Bank — 5 predefined questions per skill
# Phase 1: NO AI is used here. Pure rule-based question selection.
# Phase 2: Questions will be dynamically generated based on user difficulty.
# =============================================================================
from typing import Dict, List

# ------------------------------------------------------------------
# Opening question when certificate has sparse/no skill data
# (e.g. SAVIC cert: only company + role, no tech keywords extracted)
# ------------------------------------------------------------------
INTRO_QUESTION = (
    "Tell me about yourself — what internship or project have you done, "
    "and what technologies or skills did you work with?"
)

# ------------------------------------------------------------------
# Follow-up clarification question when skills couldn't be parsed
# from the intro answer either
# ------------------------------------------------------------------
SKILL_CLARIFICATION_QUESTION = (
    "Could you be more specific about the main technology or programming "
    "language you used most during your internship or project?"
)

# ------------------------------------------------------------------
# Generic fallback questions (used if skill not in the bank below)
# ------------------------------------------------------------------
GENERIC_QUESTIONS: List[str] = [
    "Can you describe the project or task you used this skill for?",
    "What specific features or modules did you build using this technology?",
    "What challenges did you face while working with this technology, and how did you solve them?",
    "How did you test or validate the work you did with this skill?",
    "What would you improve or do differently if you used this skill again?",
]

# ------------------------------------------------------------------
# Main question bank — 5 questions per skill
# Questions are ordered from basic → intermediate → applied
# ------------------------------------------------------------------
SKILL_QUESTIONS: Dict[str, List[str]] = {

    # ── FRONTEND ──────────────────────────────────────────────────
    "React": [
        "What is the difference between a functional component and a class component in React?",
        "Can you explain how the useState and useEffect hooks work with a real example from your project?",
        "What is the virtual DOM in React and why is it important for performance?",
        "How did you manage state across multiple components in your project — did you use Context API, Redux, or something else?",
        "Describe a specific UI component you built in React and explain how you handled its props and events.",
    ],
    "Next.js": [
        "What is the difference between getServerSideProps, getStaticProps, and getStaticPaths in Next.js?",
        "How does Next.js handle routing — explain file-based routing with an example.",
        "What is the purpose of the _app.js and _document.js files in a Next.js project?",
        "How did you use Next.js API routes in your project, and what kind of logic did you put in them?",
        "What is Incremental Static Regeneration (ISR) in Next.js and when would you use it?",
    ],
    "Vue.js": [
        "What is the Vue.js reactivity system and how does it track changes to data?",
        "Explain the difference between computed properties and watchers in Vue.",
        "How does Vue's component lifecycle work — name the hooks in order and when you'd use each.",
        "What is Vuex and how did you use it (or Pinia) to manage state in your project?",
        "How do you communicate between a parent and child component in Vue?",
    ],
    "Angular": [
        "What is dependency injection in Angular and why is it a core concept?",
        "Explain the difference between NgModule, Component, and Service in Angular.",
        "How do you handle HTTP requests in Angular — what is the HttpClient used for?",
        "What are Angular directives? Differentiate between structural and attribute directives.",
        "How did you implement routing and lazy loading in your Angular project?",
    ],
    "JavaScript": [
        "Explain the difference between var, let, and const in JavaScript.",
        "What is the event loop in JavaScript and how does it handle asynchronous operations?",
        "What is the difference between == and === in JavaScript?",
        "Can you explain closures in JavaScript with a real-world example?",
        "How does Promises and async/await work? Give an example from your project.",
    ],
    "TypeScript": [
        "What is the difference between interface and type alias in TypeScript?",
        "How does TypeScript's type system improve code reliability compared to plain JavaScript?",
        "What are generics in TypeScript and when did you use them in your project?",
        "Explain union types and intersection types with examples.",
        "How did you configure tsconfig.json for your project and what key options did you set?",
    ],
    "HTML5": [
        "What are semantic HTML elements and why are they important for accessibility and SEO?",
        "Explain the difference between the <section>, <article>, <aside>, and <main> tags.",
        "What is the HTML5 canvas element and what kind of content can it render?",
        "How do HTML5 forms support validation natively — what attributes did you use?",
        "Describe how you structured the HTML of a page you built — what semantic tags did you use?",
    ],
    "CSS3": [
        "What is the CSS Box Model and how do margin, border, padding, and content relate to each other?",
        "Explain the difference between flexbox and CSS Grid — when would you use each?",
        "What are CSS custom properties (variables) and how did you use them in your project?",
        "What is the difference between relative, absolute, fixed, and sticky positioning?",
        "How did you make your project responsive — what media queries or strategies did you use?",
    ],
    "Tailwind CSS": [
        "How does Tailwind CSS differ from traditional CSS frameworks like Bootstrap?",
        "What is the purpose of the tailwind.config.js file and what customizations did you make?",
        "How do you handle responsive design in Tailwind using its breakpoint utilities?",
        "What are Tailwind utility classes for flexbox? Give examples you used.",
        "How did you create a reusable component style in Tailwind without duplicating classes?",
    ],
    "Redux": [
        "Explain the three core principles of Redux: single source of truth, state is read-only, and pure functions.",
        "What is the difference between Redux Thunk and Redux Saga for handling async actions?",
        "Describe the flow of data in a Redux application from action dispatch to UI update.",
        "What is the Redux store and how did you connect it to React components in your project?",
        "When would you choose Redux over React Context API for state management?",
    ],

    # ── BACKEND ───────────────────────────────────────────────────
    "Python": [
        "What is the difference between a list, tuple, and dictionary in Python?",
        "Explain how decorators work in Python with a practical example.",
        "What are Python generators and when would you use yield instead of return?",
        "How does Python's GIL (Global Interpreter Lock) affect multi-threaded programs?",
        "Describe how you handled errors and exceptions in your Python project.",
    ],
    "FastAPI": [
        "What is Pydantic and how does FastAPI use it for request validation?",
        "Explain how dependency injection works in FastAPI using Depends().",
        "What is the difference between async def and def route handlers in FastAPI?",
        "How did you handle authentication and authorization in your FastAPI application?",
        "What is the lifespan context manager in FastAPI and what did you use it for?",
    ],
    "Django": [
        "Explain the MTV (Model-Template-View) architecture in Django.",
        "What is Django ORM? How did you define models and perform queries in your project?",
        "What is the difference between ForeignKey, OneToOneField, and ManyToManyField in Django?",
        "How does Django's authentication system work — what built-in views does it provide?",
        "What is middleware in Django and when would you write a custom middleware?",
    ],
    "Flask": [
        "What is the application context and request context in Flask?",
        "How do you define routes in Flask and what are route parameters?",
        "Explain how Flask-SQLAlchemy integrates with Flask for database management.",
        "What is Blueprint in Flask and why is it useful for large applications?",
        "How did you handle authentication in your Flask project — JWT, session, or other?",
    ],
    "Node.js": [
        "What is the event-driven, non-blocking I/O model in Node.js?",
        "Explain the difference between require() in CommonJS and import in ES Modules.",
        "What is the Node.js event loop and how does it process asynchronous callbacks?",
        "What is npm and how did you manage dependencies in your Node.js project?",
        "How did you handle errors in async Node.js code — try/catch, callbacks, or Promises?",
    ],
    "Express.js": [
        "What is middleware in Express.js and how does the request pipeline work?",
        "How do you define RESTful routes in Express with different HTTP methods?",
        "What is the difference between app.use() and app.get() in Express?",
        "How did you handle errors globally in your Express application?",
        "Explain how you connected Express.js to a database in your project.",
    ],

    # ── DATABASES ─────────────────────────────────────────────────
    "PostgreSQL": [
        "What is the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN in PostgreSQL?",
        "How do indexes work in PostgreSQL and when would you create one?",
        "What is a database transaction and how do COMMIT and ROLLBACK work?",
        "What is the difference between CHAR, VARCHAR, and TEXT data types in PostgreSQL?",
        "How did you design the database schema for your project — describe the tables and their relationships.",
    ],
    "MongoDB": [
        "What is the difference between a SQL database and MongoDB's document model?",
        "Explain how MongoDB handles relationships — embedding vs referencing documents.",
        "What is an aggregation pipeline in MongoDB and when did you use it?",
        "What are MongoDB indexes and how do they improve query performance?",
        "How did you connect and interact with MongoDB in your project — what library did you use?",
    ],
    "MySQL": [
        "What is the difference between InnoDB and MyISAM storage engines in MySQL?",
        "Explain normalization — what is 1NF, 2NF, and 3NF?",
        "What are stored procedures and triggers in MySQL?",
        "How do you handle transactions in MySQL to ensure data integrity?",
        "Describe the schema design you used in your MySQL project.",
    ],
    "Redis": [
        "What data structures does Redis support and when would you use each?",
        "What is the difference between Redis persistence modes: RDB and AOF?",
        "How did you use Redis for caching in your project — what did you cache and why?",
        "What is Redis pub/sub and when would you use it over a message queue?",
        "How do you handle cache invalidation when the underlying data changes?",
    ],

    # ── DEVOPS ────────────────────────────────────────────────────
    "Docker": [
        "What is the difference between a Docker image and a Docker container?",
        "What is a Dockerfile and explain the purpose of each instruction: FROM, RUN, COPY, CMD.",
        "What is docker-compose and how did you use it to run multi-container apps in your project?",
        "What is a Docker volume and why is it important for persistent data?",
        "What is the difference between ENTRYPOINT and CMD in a Dockerfile?",
    ],
    "Kubernetes": [
        "What is a Kubernetes Pod, Deployment, and Service — how do they relate?",
        "What is the difference between a ClusterIP, NodePort, and LoadBalancer service type?",
        "How does Kubernetes handle auto-scaling with HorizontalPodAutoscaler?",
        "What is a Kubernetes ConfigMap and Secret and when would you use each?",
        "Describe how you deployed an application to Kubernetes in your project.",
    ],
    "AWS": [
        "What is the difference between EC2, Lambda, and ECS in AWS?",
        "What is an S3 bucket and what types of data did you store in it?",
        "How does IAM (Identity and Access Management) work in AWS?",
        "What is the difference between a security group and a network ACL in AWS VPC?",
        "Describe a service you built or deployed on AWS and the architecture you chose.",
    ],
    "Git": [
        "What is the difference between git merge and git rebase?",
        "Explain the Git branching strategy your team used — GitFlow, trunk-based, or other?",
        "What does git stash do and when did you use it in your project?",
        "How do you resolve a merge conflict in Git?",
        "What is the difference between git fetch and git pull?",
    ],

    # ── AI / ML ───────────────────────────────────────────────────
    "Machine Learning": [
        "What is the difference between supervised, unsupervised, and reinforcement learning?",
        "What is the bias-variance tradeoff and how does it affect model performance?",
        "What is cross-validation and why is it important to evaluate a model correctly?",
        "Explain overfitting — how did you detect and prevent it in your project?",
        "Describe the end-to-end ML pipeline you built — from data collection to model deployment.",
    ],
    "Deep Learning": [
        "What is a neural network and what is the role of activation functions?",
        "What is backpropagation and how does gradient descent update model weights?",
        "What is the difference between CNN (Convolutional Neural Network) and RNN (Recurrent Neural Network)?",
        "What is dropout regularization and why is it used in deep learning?",
        "Describe the deep learning model you trained — what architecture, loss function, and optimizer did you use?",
    ],
    "NLP": [
        "What is tokenization in NLP and why is it the first step in text processing?",
        "What is the difference between stemming and lemmatization?",
        "Explain how TF-IDF works and when you would use it over word embeddings.",
        "What are word embeddings — how is Word2Vec different from GloVe or BERT?",
        "Describe the NLP task you solved in your project — classification, NER, summarization, or other?",
    ],
    "Computer Vision": [
        "What is the difference between image classification, object detection, and image segmentation?",
        "How does a Convolutional Neural Network (CNN) extract features from an image?",
        "What is transfer learning and which pre-trained model (ResNet, VGG, EfficientNet) did you use?",
        "What is data augmentation in computer vision and which techniques did you apply?",
        "Describe the computer vision project you worked on — what dataset, model, and accuracy did you achieve?",
    ],
    "TensorFlow": [
        "What is the difference between TensorFlow's eager execution and graph execution?",
        "How does the Keras API fit into TensorFlow 2.x?",
        "What is a TensorFlow Dataset (tf.data) and why is it preferred for training pipelines?",
        "How did you save and load a TensorFlow model in your project?",
        "Describe the neural network architecture you built with TensorFlow.",
    ],
    "PyTorch": [
        "What is the difference between a Tensor and a numpy array in PyTorch?",
        "How does PyTorch's autograd system compute gradients automatically?",
        "What is DataLoader in PyTorch and what does the Dataset class require you to implement?",
        "Explain the training loop in PyTorch — forward pass, loss, backward, optimizer.step().",
        "How did you evaluate your PyTorch model — what metrics did you track?",
    ],
    "LangChain": [
        "What is LangChain and what problem does it solve for LLM-based applications?",
        "What is a LangChain Chain and how do you compose multiple steps together?",
        "What is a LangChain Agent and how is it different from a simple Chain?",
        "How does Retrieval-Augmented Generation (RAG) work and how did you implement it?",
        "What vector store did you use with LangChain and how did you embed documents?",
    ],
    "Generative AI": [
        "What is the difference between a generative model and a discriminative model?",
        "How does a Large Language Model (LLM) generate text — explain the transformer architecture briefly.",
        "What is prompt engineering and what techniques did you use in your project?",
        "What is fine-tuning vs in-context learning for LLMs — when would you choose each?",
        "Describe the generative AI application you built — what model, API, and use case?",
    ],

    # ── MOBILE ────────────────────────────────────────────────────
    "Flutter": [
        "What is the widget tree in Flutter and what is the difference between StatelessWidget and StatefulWidget?",
        "How does Flutter's hot reload work and how did it speed up your development?",
        "What is the setState() method and when should you use it?",
        "How did you handle navigation between screens in your Flutter app?",
        "What package did you use for state management in Flutter — Provider, Riverpod, or BLoC?",
    ],
    "Android": [
        "What is the difference between Activity, Fragment, and Service in Android?",
        "How does the Android Activity lifecycle work — name the lifecycle methods in order?",
        "What is the purpose of Intents in Android and what are the two types?",
        "What is ViewModel in Android Jetpack and how does it survive configuration changes?",
        "Describe the Android app you built — what features, SDK APIs, and architecture pattern?",
    ],

    # ── OTHER ─────────────────────────────────────────────────────
    "GraphQL": [
        "What is the difference between GraphQL and REST API?",
        "What is a GraphQL schema and how do you define types, queries, and mutations?",
        "What is the N+1 query problem in GraphQL and how does DataLoader solve it?",
        "How did you handle authentication in your GraphQL API?",
        "What GraphQL client did you use on the frontend — Apollo Client, urql, or other?",
    ],
    "REST API": [
        "What are the HTTP methods GET, POST, PUT, PATCH, and DELETE used for in REST?",
        "What is the difference between stateless and stateful APIs?",
        "What are HTTP status codes — give examples of 2xx, 4xx, and 5xx codes and when each applies.",
        "How did you version your REST API and why is versioning important?",
        "How did you document your REST API — Swagger, Postman collection, or other?",
    ],
    "AI/ML": [
        "What is the difference between supervised and unsupervised learning?",
        "What is a training set, validation set, and test set — why keep them separate?",
        "How did you evaluate your model — what metrics (accuracy, F1, AUC) did you use and why?",
        "Describe the dataset you worked with — its size, features, and any preprocessing you did.",
        "What AI or ML library did you use in your project and what model did you train or fine-tune?",
    ],
    "RAG": [
        "What is Retrieval-Augmented Generation and why is it better than pure LLM for knowledge tasks?",
        "What is a vector embedding and how is semantic similarity used in RAG retrieval?",
        "What chunking strategy did you use when indexing documents for RAG?",
        "How did you evaluate the quality of your RAG pipeline's answers?",
        "Describe the RAG system you built — what documents, vector store, and LLM did you use?",
    ],
    "LLM": [
        "What is attention mechanism in a transformer and why is it important?",
        "What is the difference between GPT, BERT, and T5 model architectures?",
        "What is tokenization in LLMs and what is a token?",
        "How did you call an LLM API in your project — what parameters did you tune?",
        "What safety or hallucination issues did you encounter with LLMs and how did you handle them?",
    ],
    "OpenAI API": [
        "What is the difference between the chat completions and completions endpoints in OpenAI API?",
        "What are system, user, and assistant roles in the OpenAI chat format?",
        "What are temperature and max_tokens parameters and how did you tune them?",
        "How did you handle rate limits and errors when calling the OpenAI API?",
        "Describe the feature or application you built using the OpenAI API.",
    ],
}

# Skills that map to an existing key in SKILL_QUESTIONS
SKILL_ALIAS_MAP: Dict[str, str] = {
    "reactjs": "React",
    "react.js": "React",
    "nextjs": "Next.js",
    "vuejs": "Vue.js",
    "vue.js": "Vue.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "expressjs": "Express.js",
    "express.js": "Express.js",
    "nestjs": "NestJS",
    "nest.js": "NestJS",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "ml": "Machine Learning",
    "ai": "AI/ML",
    "artificial intelligence": "AI/ML",
    "natural language processing": "NLP",
    "restapi": "REST API",
    "rest api": "REST API",
}


def get_questions_for_skill(skill: str) -> List[str]:
    """
    Return the 5 predefined questions for a given skill.
    Falls back to GENERIC_QUESTIONS if the skill is not in the bank.
    """
    # Try direct match
    if skill in SKILL_QUESTIONS:
        return SKILL_QUESTIONS[skill]

    # Try alias resolution
    resolved = SKILL_ALIAS_MAP.get(skill.lower())
    if resolved and resolved in SKILL_QUESTIONS:
        return SKILL_QUESTIONS[resolved]

    # Try case-insensitive match
    for key in SKILL_QUESTIONS:
        if key.lower() == skill.lower():
            return SKILL_QUESTIONS[key]

    # Fallback
    return [q.replace("this technology", skill).replace("this skill", skill)
            for q in GENERIC_QUESTIONS]


def get_question_at_index(skill: str, index: int) -> str | None:
    """
    Return a specific question by index (0-4).
    Returns None if index is out of range (interview complete for this skill).
    """
    questions = get_questions_for_skill(skill)
    if index < len(questions):
        return questions[index]
    return None

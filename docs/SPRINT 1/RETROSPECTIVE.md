# Technological Problems:
- Docker: A lot of time has been lost with backend build errors due to changing configurations in docker-compose and problems with the database. This has prevented the correct functioning of the page and user identification (login problems).

- Multiprocessing vs Queues: The initial design of BLAST used multiprocessing, but this generated problems and redundancies. It was decided to migrate to a queue system, which ended up working better.

- Slow BLAST API: The response time is very high, making testing and UX complicated.

# Group Dynamics Problems:
- Load imbalance: Álvaro has been stuck with BLAST for a long time and this has meant that Víctor has taken over almost all the other functionalities. It has been managed well, but planning and early detection of blockages need to be improved.

# Improvement proposal:
- Improve the Docker infrastructure: review and fix versions to avoid breakage..

- Dependency-based planning: prioritize essential features over derived features, such as AI.

- Fix node.js from the beginning: Fix the dependencies conflicts of package.json before doing anything related to it. 
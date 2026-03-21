# GenomIQ

<div align="center">
  <img src="docs/logo-genomiq.png" alt="GenomIQ Logo" width="200"/>
  
  🌎 **Live site:** [https://genomiq.cat/](https://genomiq.cat/)
</div>

## About the Project

### Objective
Our goal is to create an interactive and intelligent platform that automates, explains and optimizes the analysis of sequences and other biological functions, improving the experience of both novice and expert users with respect to the current pages.

### Motivation
We aim to make the definitive tool for researchers and bioinformaticians, both professionals and experts. Current tools have outdated interfaces, could be better optimized, and require advanced knowledge. We want to modernize these tools, make them more accessible, and enhance them with AI.

## Documentation

📚 **Project Documentation:**

- [User Stories](docs/USER_STORIES.md)
- [Data Sources](docs/DATA_FONT.md)
- [Goals](docs/GOALS.md)
- [Mockups](docs/MOCKUPS/)
- [Requirements](docs/REQUIREMENTS.md)
- [Technologies](docs/TECHNOLOGIES.md)
- [Risk Analysis](docs/RISK_ANALYSIS.md)
- [Definition of Done](docs/DOD.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Operating Flow Chart](docs/flowchartdiagram.mermaid)
- [Data Model](docs/DATA%20MODEL/)
- [Review Retrospective](https://goo.su/3C4O9)/[Image](docs/ReviewRetrospective.png)
- [Sprint 1](docs/SPRINT%201/)
- [Sprint 2](docs/SPRINT%202/)
- [Sprint 3](docs/SPRINT%203/)
- [TODO](docs/TODO.md)

## Development Guide

### Setting Up with Docker

```sh
# Login to GitLab registry
$ docker login registry.gitlab.com

# Start all services
$ docker compose up -d
```

Then open your browser at [https://localhost:3000](https://localhost:3000)

### Database Management

Access to PostgreSQL: 
```sh
docker exec -it genomiq-db-1 psql -U genomiq -d postgres
```

Starting a PostgreSQL database:

```sh
$ docker run --name db postgres
```

Accessing the database directly:

```sh
# From host machine
$ psql -h localhost -p 5432 -U genomiq -d genomiq

# From inside the container
$ docker exec -it genomiq-db-1 psql -U genomiq -d genomiq

# List tables
\dt

# Delete all tables
DO
$$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END;
$$;

```
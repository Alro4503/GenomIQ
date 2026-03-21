# Questions to be asked in order to create it

## What quality criteria must the code meet?
- Code follows established standards: PEP8 (Python), ESLint (JavaScript).
- Variable, function, and class names are clear and meaningful.
- Code is modular, avoids redundancy, and follows SOLID principles.
- All functions and modules include documentation.

## What test evidences have to be documented?
- Results of unit tests, integration and regression.
- CI/CD execution logs.

## Integration tests have to be done? regression tests? which functionalities?
- Automated tests pass successfully in CI/CD pipeline.
- Integration tests validate API calls and component interactions.
- Regression to ensure that new upgrades do not break existing functionality.

## What quality criteria (usability, accessibility, compatibility, response time...) must the web page pass?
- UI is intuitive, follows usability heuristics, and matches design specs.
- Accessibility compliance: WCAG 2.1 AA standards.
- Works on Chrome, Firefox, Edge, and Safari, with responsive design.
- Page load times are <2s for main features.

## What documentation must be reviewed and updated?
- App flow chart
- README.md
- Data model diagram
- BACKEND_CLASSES.md
- DATABASE_TABLES.md

## What security aspects must be considered?
- Input validation prevents SQL injection, XSS, CSRF.
- Passwords and API keys are encrypted and never hardcoded.
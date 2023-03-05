# tes
Automate unit testing with tes! generate unit tests for JavaScript and Typescript applications.

# setup
- create a .env file with OPENAI_KEY={YOUR_OPENAI_KEY}
- if your moving tes.js to your project, then also install dependencies: 
    "@babel/parser"
    "dotenv"
    "ignore"
    "openai"

# example
- `npm run start --file="./tes.js" --libraries="jest" --targets="traverseFolder" --output="traverse.js"`

# options

- `--file=` the target file path
- `--libraries=`the test framework it should use, e.g jest, enzyme or react-test-utils etc!
- `--targets=` its  better to target specific functions or objects rather than the whole file! (we are limited by AI total output)
- `--output=` optional output file, if none is provided it will create a test file based on orginal file name.
- `--src=` optional instead of file you can pass src, not recommeded as again we limited due to OpenAI total output.


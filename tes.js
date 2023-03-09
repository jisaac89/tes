
require('dotenv').config();
const apiKey = process.env.OPENAI_KEY;
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const parser = require('@babel/parser');
const ignore = require('ignore');
const path = require('path');

const configuration = new Configuration({
    apiKey,
});

const openai = new OpenAIApi(configuration);

const generateTestCase = async (file, targets) => {
    const fileContents = fs.readFileSync(file, 'utf8');
    const fileExtension = file.split('.').pop();
    let languageModel;
    let code;

    if (fileExtension === 'ts' || fileExtension === 'tsx') {
        languageModel = 'typescript';
        code = parseTypeScript(fileContents);
    } else if (fileExtension === 'jsx' || fileExtension === 'js') {
        languageModel = 'javascript';
        code = parseJavaScript(fileContents);
    } else {
        console.error(`Unsupported file extension: ${fileExtension}`);
        return;
    }

    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {}).concat(Object.keys(packageJson.devDependencies || {})).join('\n');


    const onlyForVerbiage = `Only write test cases for the `;
    const prompt = `Write strict ${languageModel} ${process.env.npm_config_libraries} unit tests for the following:

    ${code}
    
    The code is located in the local file ${file}. 

    ${targets ? targets.split(',').length ? onlyForVerbiage + targets.split(',').map(target => `${target}.`) : onlyForVerbiage + targets : ''}
    
    Use the same code style of quotes, indentation, etc. when generating the unit tests.
    
    The unit tests should handle both valid and invalid inputs, including edge cases and error conditions.
    
    Generate at least three (3) unit tests for the function, covering different input values and scenarios`;


    const completions = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: prompt,
        max_tokens: 1300,
        n: 1,
    });

    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
    });

    const testCase = completions.data.choices[0].text.trim()
    const testFile = file.replace(`.${fileExtension}`, `.test.${fileExtension}`);
    // replace name if 
    if (process.env.npm_config_output) {
        const output = process.env.npm_config_output;
        const outputExtension = output.split('.').pop();
        const outputFileName = path.basename(output, `.${outputExtension}`);
        const outputFilePath = path.dirname(output);
        const newTestFile = path.join(outputFilePath, `${outputFileName}.test.${outputExtension}`);
        fs.writeFileSync(newTestFile, testCase, { encoding: 'utf8', flag: 'w' });
        return;
    }

    fs.writeFileSync(testFile, testCase, { encoding: 'utf8', flag: 'w' });
}

function parseJavaScript(code) {
    const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
    return ast.program.body.map(node => node.type === 'ImportDeclaration' ? '' : code.substring(node.start, node.end)).join('\n');
}

function parseTypeScript(code) {
    const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    return ast.program.body.map(node => node.type === 'ImportDeclaration' ? '' : code.substring(node.start, node.end)).join('\n');
}

function findFile(filePath, targets) {
    const folderPath = path.dirname(filePath);
    const fileExtension = filePath.split('.').pop();
    const testFile = path.join(folderPath, `${path.basename(filePath, `.${fileExtension}`)}.test.${fileExtension}`);
    const hasTestFile = fs.existsSync(testFile);
    if (hasTestFile && !process.env.npm_config_output) {
        console.log(`Skipping ${filePath} because unit tests exists.`);
        return;
    } else {
        if (fileExtension === 'js' || fileExtension === 'jsx' || fileExtension === 'ts' || fileExtension === 'tsx') {
            console.log(`Generating test case for ${filePath}...`);
            generateTestCase(filePath, targets);
        } else {
            console.log(`Skipping ${filePath} because it is not a JavaScript or TypeScript file.`);
            return;
        }
    }
}

function traverseFolder(folderPath, ignoreList) {
    const files = fs.readdirSync(folderPath);
    const ig = ignore().add(ignoreList);
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        if (ig.ignores(path.relative(process.cwd(), filePath))) {
            continue;
        }
        if (fs.statSync(filePath).isDirectory()) {
            traverseFolder(filePath, ignoreList);
        } else {
            findFile(filePath);
        }
    }
}

const ignoreFile = (string) => fs.readFileSync(string, 'utf8').split('\n').filter(line => !line.startsWith('#') && line.trim() !== '')
const tesignore = ignoreFile('.tesignore');
const gitignore = ignoreFile('.gitignore');
const ignoreList = [...tesignore, ...gitignore];

if (process.env.npm_config_src) {
    traverseFolder(process.env.npm_config_src, ignoreList);
} else {
    findFile(process.env.npm_config_file, process.env.npm_config_targets);
}

module.exports = { generateTestCase, parseJavaScript, parseTypeScript, findFile, traverseFolder }
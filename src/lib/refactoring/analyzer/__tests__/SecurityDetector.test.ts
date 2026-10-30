/**
 * SecurityDetector Unit Tests
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityDetector } from '../SecurityDetector';

describe('SecurityDetector', () => {
	let detector: SecurityDetector;

	beforeEach(() => {
		detector = new SecurityDetector();
	});

	// ============================================================================
	// INITIALIZATION
	// ============================================================================

	describe('Initialization', () => {
		it('should create detector instance', () => {
			expect(detector).toBeDefined();
			expect(detector).toBeInstanceOf(SecurityDetector);
		});
	});

	// ============================================================================
	// HARDCODED SECRETS DETECTION
	// ============================================================================

	describe('detectHardcodedSecrets', () => {
		it('should detect hardcoded passwords', () => {
			const content = `
const config = {
	password: "MySecretPass123"
};
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssue = issues.find(i => i.title.includes('password'));

			expect(secretIssue).toBeDefined();
			expect(secretIssue?.severity).toBe('error');
			expect(secretIssue?.category).toBe('security');
		});

		it('should detect API keys', () => {
			const content = `
const apiKey = "1234567890abcdef1234567890abcdef";
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssue = issues.find(i => i.title.includes('API key'));

			expect(secretIssue).toBeDefined();
		});

		it('should detect OpenAI API keys', () => {
			const content = `
const openaiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssue = issues.find(i => i.title.includes('OpenAI'));

			expect(secretIssue).toBeDefined();
		});

		it('should detect GitHub tokens', () => {
			const content = `
const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssue = issues.find(i => i.title.includes('GitHub'));

			expect(secretIssue).toBeDefined();
		});

		it('should detect AWS access keys', () => {
			const content = `
const awsKey = "AKIAIOSFODNN7EXAMPLE";
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssue = issues.find(i => i.title.includes('AWS'));

			expect(secretIssue).toBeDefined();
		});

		it('should not flag environment variables', () => {
			const content = `
const password = process.env.PASSWORD;
const apiKey = import.meta.env.VITE_API_KEY;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssues = issues.filter(i => i.category === 'security' && i.title.includes('hardcoded'));

			expect(secretIssues.length).toBe(0);
		});

		it('should not flag placeholders', () => {
			const content = `
const password = "YOUR_PASSWORD_HERE";
const apiKey = "example-api-key-placeholder";
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssues = issues.filter(i => i.category === 'security' && i.title.includes('hardcoded'));

			expect(secretIssues.length).toBe(0);
		});

		it('should not flag config references', () => {
			const content = `
const password = config.password;
const apiKey = config.apiKey;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const secretIssues = issues.filter(i => i.category === 'security' && i.title.includes('hardcoded'));

			expect(secretIssues.length).toBe(0);
		});
	});

	// ============================================================================
	// SQL INJECTION DETECTION
	// ============================================================================

	describe('detectSQLInjection', () => {
		it('should detect SQL concatenation with user input', () => {
			const content = `
const query = "SELECT * FROM users WHERE id = " + req.params.id;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const sqlIssue = issues.find(i => i.title.includes('SQL injection'));

			expect(sqlIssue).toBeDefined();
			expect(sqlIssue?.severity).toBe('error');
			expect(sqlIssue?.category).toBe('security');
		});

		it('should detect SQL template literals with user input', () => {
			const content = `
const query = \`SELECT * FROM users WHERE name = \${req.body.name}\`;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const sqlIssue = issues.find(i => i.title.includes('SQL injection'));

			expect(sqlIssue).toBeDefined();
		});

		it('should detect query() with string concatenation', () => {
			const content = `
db.query("SELECT * FROM users WHERE id = " + userId);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const sqlIssue = issues.find(i => i.title.includes('SQL injection'));

			expect(sqlIssue).toBeDefined();
		});

		it('should detect execute() with string concatenation', () => {
			const content = `
db.execute("INSERT INTO users VALUES (" + req.body.name + ")");
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const sqlIssue = issues.find(i => i.title.includes('SQL injection'));

			expect(sqlIssue).toBeDefined();
		});

		it('should not flag protected queries', () => {
			const content = `
// SQL injection protected
const query = "SELECT * FROM users WHERE id = " + sanitizedId;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const sqlIssue = issues.find(i => i.title.includes('SQL injection'));

			expect(sqlIssue).toBeUndefined();
		});
	});

	// ============================================================================
	// XSS DETECTION
	// ============================================================================

	describe('detectXSS', () => {
		it('should detect innerHTML assignment', () => {
			const content = `
element.innerHTML = userInput;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeDefined();
			expect(xssIssue?.severity).toBe('error');
			expect(xssIssue?.category).toBe('security');
		});

		it('should detect outerHTML assignment', () => {
			const content = `
element.outerHTML = data;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeDefined();
		});

		it('should detect document.write', () => {
			const content = `
document.write(content);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeDefined();
		});

		it('should detect dangerouslySetInnerHTML in React', () => {
			const content = `
<div dangerouslySetInnerHTML={{ __html: userContent }} />
			`;

			const issues = detector.detectIssues(content, 'test.tsx', 'typescript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeDefined();
		});

		it('should detect {@html} in Svelte', () => {
			const content = `
<div>{@html userContent}</div>
			`;

			const issues = detector.detectIssues(content, 'test.svelte', 'javascript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeDefined();
		});

		it('should not flag sanitized content', () => {
			const content = `
element.innerHTML = DOMPurify.sanitize(userInput);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeUndefined();
		});

		it('should not flag textContent', () => {
			const content = `
element.textContent = userInput;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeUndefined();
		});

		it('should only check JavaScript/TypeScript', () => {
			const content = `
print("<script>alert('xss')</script>")
			`;

			const issues = detector.detectIssues(content, 'test.py', 'python');
			const xssIssue = issues.find(i => i.title.includes('XSS'));

			expect(xssIssue).toBeUndefined();
		});
	});

	// ============================================================================
	// UNSAFE EVAL DETECTION
	// ============================================================================

	describe('detectUnsafeEval', () => {
		it('should detect eval() usage', () => {
			const content = `
const result = eval(userCode);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const evalIssue = issues.find(i => i.title.includes('eval()'));

			expect(evalIssue).toBeDefined();
			expect(evalIssue?.severity).toBe('error');
			expect(evalIssue?.category).toBe('security');
		});

		it('should detect new Function()', () => {
			const content = `
const fn = new Function('x', 'return x * 2');
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const evalIssue = issues.find(i => i.title.includes('Function()'));

			expect(evalIssue).toBeDefined();
		});

		it('should detect setTimeout with string', () => {
			const content = `
setTimeout("alert('hello')", 1000);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const evalIssue = issues.find(i => i.title.includes('setTimeout'));

			expect(evalIssue).toBeDefined();
		});

		it('should detect setInterval with string', () => {
			const content = `
setInterval("console.log('tick')", 1000);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const evalIssue = issues.find(i => i.title.includes('setInterval'));

			expect(evalIssue).toBeDefined();
		});

		it('should detect Python eval', () => {
			const content = `
result = eval(user_input)
			`;

			const issues = detector.detectIssues(content, 'test.py', 'python');
			const evalIssue = issues.find(i => i.title.includes('eval()'));

			expect(evalIssue).toBeDefined();
		});

		it('should detect Python exec', () => {
			const content = `
exec(user_code)
			`;

			const issues = detector.detectIssues(content, 'test.py', 'python');
			const execIssue = issues.find(i => i.title.includes('exec()'));

			expect(execIssue).toBeDefined();
		});
	});

	// ============================================================================
	// WEAK CRYPTOGRAPHY DETECTION
	// ============================================================================

	describe('detectWeakCrypto', () => {
		it('should detect Math.random() in crypto context', () => {
			const content = `
const token = Math.random().toString(36);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const cryptoIssue = issues.find(i => i.title.includes('random'));

			expect(cryptoIssue).toBeDefined();
			expect(cryptoIssue?.severity).toBe('warning');
			expect(cryptoIssue?.category).toBe('security');
		});

		it('should detect MD5 usage', () => {
			const content = `
const hash = crypto.createHash('md5').update(password).digest('hex');
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const cryptoIssue = issues.find(i => i.title.includes('MD5'));

			expect(cryptoIssue).toBeDefined();
		});

		it('should detect SHA1 usage', () => {
			const content = `
import SHA1 from 'crypto-js/sha1';
const hash = SHA1(data);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const cryptoIssue = issues.find(i => i.title.includes('SHA1'));

			expect(cryptoIssue).toBeDefined();
		});

		it('should not flag Math.random() in non-crypto context', () => {
			const content = `
const randomColor = Math.random() * 255;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const cryptoIssues = issues.filter(i => i.title.includes('random'));

			// Should not flag because no crypto keywords in line
			expect(cryptoIssues.length).toBe(0);
		});
	});

	// ============================================================================
	// PATH TRAVERSAL DETECTION
	// ============================================================================

	describe('detectPathTraversal', () => {
		it('should detect fs.readFile with user input', () => {
			const content = `
fs.readFile(req.params.filename, callback);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const pathIssue = issues.find(i => i.title.includes('path traversal'));

			expect(pathIssue).toBeDefined();
			expect(pathIssue?.severity).toBe('error');
			expect(pathIssue?.category).toBe('security');
		});

		it('should detect fs.readFileSync with user input', () => {
			const content = `
const data = fs.readFileSync(req.query.file);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const pathIssue = issues.find(i => i.title.includes('path traversal'));

			expect(pathIssue).toBeDefined();
		});

		it('should detect __dirname concatenation with user input', () => {
			const content = `
const filePath = __dirname + req.params.path;
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const pathIssue = issues.find(i => i.title.includes('path traversal'));

			expect(pathIssue).toBeDefined();
		});

		it('should detect path.join with user input', () => {
			const content = `
const fullPath = path.join(__dirname, req.body.filename);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const pathIssue = issues.find(i => i.title.includes('path traversal'));

			expect(pathIssue).toBeDefined();
		});

		it('should not flag sanitized paths', () => {
			const content = `
const safePath = path.basename(req.params.filename);
fs.readFile(safePath, callback);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const pathIssue = issues.find(i => i.title.includes('path traversal'));

			expect(pathIssue).toBeUndefined();
		});

		it('should not flag path.normalize usage', () => {
			const content = `
const normalizedPath = path.normalize(req.params.path);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');
			const pathIssue = issues.find(i => i.title.includes('path traversal'));

			expect(pathIssue).toBeUndefined();
		});
	});

	// ============================================================================
	// INTEGRATION TESTS
	// ============================================================================

	describe('Integration', () => {
		it('should detect multiple security issues in same file', () => {
			const content = `
const password = "hardcoded123";
const query = "SELECT * FROM users WHERE id = " + req.params.id;
element.innerHTML = userInput;
eval(userCode);
const token = Math.random().toString(36);
fs.readFile(req.params.file);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');

			expect(issues.length).toBeGreaterThanOrEqual(5);
			expect(issues.some(i => i.title.includes('password'))).toBe(true);
			expect(issues.some(i => i.title.includes('SQL'))).toBe(true);
			expect(issues.some(i => i.title.includes('XSS'))).toBe(true);
			expect(issues.some(i => i.title.includes('eval'))).toBe(true);
		});

		it('should handle secure code without issues', () => {
			const content = `
const password = process.env.PASSWORD;
const query = db.prepare("SELECT * FROM users WHERE id = ?").run(userId);
element.textContent = userInput;
const token = crypto.randomBytes(32).toString('hex');
const safePath = path.basename(filename);
			`;

			const issues = detector.detectIssues(content, 'test.ts', 'typescript');

			expect(issues.length).toBe(0);
		});

		it('should work across different languages', () => {
			const jsContent = `eval(userInput);`;
			const pyContent = `exec(user_input)`;

			const jsIssues = detector.detectIssues(jsContent, 'test.js', 'javascript');
			const pyIssues = detector.detectIssues(pyContent, 'test.py', 'python');

			expect(jsIssues.length).toBeGreaterThan(0);
			expect(pyIssues.length).toBeGreaterThan(0);
		});
	});
});

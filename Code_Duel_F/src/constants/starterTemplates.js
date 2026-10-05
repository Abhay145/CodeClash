/**
 * starterTemplates — default starter code per language.
 *
 * These are generic placeholders shown in the editor BEFORE
 * a problem is loaded. Once a problem loads, its own
 * `problem.starterCode[lang]` takes over (populated from DB).
 *
 * Add / update the per-problem starter code in your DB;
 * these are purely the "empty editor" fallback.
 */

export const STARTER_TEMPLATES = {
  javascript: `// JavaScript solution
// Write your solution below

function solution() {
  // TODO
}
`,

  typescript: `// TypeScript solution
// Write your solution below

function solution(): void {
  // TODO
}
`,

  python: `# Python 3 solution
# Write your solution below

def solution():
    # TODO
    pass
`,

  ruby: `# Ruby solution
# Write your solution below

def solution()
  # TODO
end
`,

  php: `<?php
// PHP solution
// Write your solution below

function solution() {
    // TODO
}
`,

  bash: `#!/bin/bash
# Bash solution
# Write your solution below

`,

  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// C solution
// Write your solution below

int main() {
    // TODO
    return 0;
}
`,

  cpp: `#include <bits/stdc++.h>
using namespace std;

// C++ 17 solution
// Write your solution below

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // TODO

    return 0;
}
`,

  java: `import java.util.*;
import java.io.*;

// Java solution
// Write your solution below

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // TODO
    }
}
`,

  csharp: `using System;
using System.Collections.Generic;
using System.Linq;

// C# solution
// Write your solution below

public class Solution {
    public static void Main(string[] args) {
        // TODO
    }
}
`,

  go: `package main

import "fmt"

// Go solution
// Write your solution below

func main() {
    // TODO
    fmt.Println()
}
`,

  rust: `// Rust solution
// Write your solution below

fn main() {
    // TODO
}
`,

  swift: `import Foundation

// Swift solution
// Write your solution below

func solution() {
    // TODO
}

solution()
`,

  kotlin: `// Kotlin solution
// Write your solution below

fun main() {
    // TODO
}
`,

  scala: `// Scala solution
// Write your solution below

object Solution extends App {
    // TODO
}
`,
};

/**
 * Get starter code for a given language, falling back to a generic placeholder.
 * If the problem provides its own starter code, prefer that instead.
 *
 * @param {string} langId         - e.g. 'cpp'
 * @param {object|null} problem   - problem object from DB (may have starterCode map)
 */
export function getStarterCode(langId, problem = null) {
  // Prefer problem-specific starter code from DB
  if (problem?.starterCode?.[langId]) {
    return problem.starterCode[langId];
  }
  // Fall back to generic template
  return STARTER_TEMPLATES[langId] ?? `// Write your ${langId} solution here\n`;
}

/**
 * Utilities for extracting and managing hashtags within expense notes.
 */

/**
 * Extracts all unique hashtags from a given text.
 * Example: "Lunch #food #work" -> ["food", "work"]
 */
export function extractTags(text: string | undefined | null): string[] {
    if (!text) return [];
    
    // Match # followed by non-whitespace characters
    // Using positive lookbehind for space or start of string to avoid matching URLs like http://foo#bar
    // Note: JavaScript regex doesn't support lookbehind across all browsers, so we use a simpler approach
    // and clean up the matches.
    
    const regex = /(?:^|\s)#([^\s#]+)/g;
    const tags = new Set<string>();
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        // match[1] contains the actual tag word without the #
        if (match[1]) {
            tags.add(match[1]);
        }
    }
    
    return Array.from(tags);
}

/**
 * Strips all hashtags from a given text, returning only the plain text.
 * Example: "Lunch #food #work" -> "Lunch"
 */
export function stripTags(text: string | undefined | null): string {
    if (!text) return "";
    
    // Replace hashtag patterns with empty string, then clean up extra spaces
    return text.replace(/(?:^|\s)#[^\s#]+/g, '').trim().replace(/\s{2,}/g, ' ');
}

/**
 * Gets the most frequently used tags from a list of expenses.
 */
export function getTopTags(expenses: Array<{ note?: string | null }>, limit: number = 5): string[] {
    if (!expenses || expenses.length === 0) return [];
    
    const tagCounts = new Map<string, number>();
    
    // Count frequencies
    for (const expense of expenses) {
        if (!expense.note) continue;
        
        const tags = extractTags(expense.note);
        for (const tag of tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
    }
    
    // Sort by count (descending) and return top N
    return Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1]) // sort by count descending
        .slice(0, limit)
        .map(entry => entry[0]); // map back to just the tag names
}

/**
 * useProblem — fetches a problem from the backend API
 *
 * - If problemId is provided → GET /api/problems/:problemId
 * - If problemId is null/undefined → GET /api/problems/random
 *
 * hiddenTestCases are NEVER returned by the backend.
 *
 * Returned shape:
 * {
 *   id, title, difficulty, rating, topic,
 *   description, constraints, inputFormat, outputFormat,
 *   sampleTestCases: [{ input, output, explanation? }]
 * }
 */

import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * @param {string|null|undefined} problemId
 *   Pass null/undefined to fetch a random problem via GET /api/problems/random.
 *
 * @param {boolean} [skip=false]
 *   When true, the fetch is suppressed (e.g. while waiting for a room to resolve
 *   its problemId from Firestore). Loading stays true.
 *
 * @param {number} [refetchKey=0]
 *   Increment this to force a fresh fetch even when problemId hasn't changed.
 *   Useful in Practice mode: keep problemId=undefined and bump refetchKey to get
 *   a new random problem each time.
 *
 * @returns {{ problem: object|null, loading: boolean, error: string|null }}
 */
export function useProblem(problemId, skip = false, refetchKey = 0) {
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (skip) {
      setLoading(true);
      return;
    }
    let cancelled = false;

    async function fetchProblem() {
      setLoading(true);
      setError(null);
      setProblem(null);

      // Use /random when no specific ID is provided
      const url = problemId
        ? `${API_BASE}/api/problems/${problemId}`
        : `${API_BASE}/api/problems/random`;

      console.log('[useProblem] problemId received:', problemId);
      console.log('[useProblem] fetching URL:', url);

      try {
        const res = await fetch(url);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        console.log('[useProblem] data received:', data);

        if (!cancelled) {
          setProblem(data);
        }
      } catch (err) {
        console.error('[useProblem] fetch error:', err.message, '| URL was:', url);
        if (!cancelled) {
          setError(err.message || 'Failed to load problem');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProblem();

    return () => {
      cancelled = true;
    };
    // refetchKey is intentionally included so callers can force a re-fetch
    // (e.g. Practice "Shuffle" button) without changing problemId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, skip, refetchKey]);

  return { problem, loading, error };
}

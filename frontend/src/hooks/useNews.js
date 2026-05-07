/**
 * hooks/useNews.js
 * Custom hook for fetching and managing trending news.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { newsApi } from '../services/api';

export function useNews({ source = 'br' } = {}) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNews = useCallback(async (cat = category, query = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = query ? { q: query, source } : { category: cat, source };
      const data = await newsApi.getTrending(params);
      setArticles(data.articles || []);
    } catch (err) {
      setError(err.message);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [category, source]);

  useEffect(() => {
    fetchNews(category, '');
  }, [category, source]);

  const debounceRef = useRef(null);

  const search = useCallback((query) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (query.trim().length >= 3) {
        fetchNews(category, query.trim());
      } else {
        fetchNews(category, '');
      }
    }, 600);
  }, [category, fetchNews]);

  const refresh = useCallback(() => {
    fetchNews(category, searchQuery);
  }, [category, searchQuery, fetchNews]);

  return {
    articles,
    loading,
    error,
    category,
    setCategory,
    searchQuery,
    search,
    refresh,
  };
}

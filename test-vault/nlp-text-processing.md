---
uuid: "fa051917-439e-47b1-b0fc-9a1f88587cc6"
type: knowledge
status: draft
created: "2026-04-06"
modified: "2026-04-07"
tags: [nlp, text-processing, machine-learning, tokenization]
related:
  - "a3a4f67f-d203-4319-a07d-8277c0b4f479"
  - "1e9a0588-14bc-4934-807f-24d96949de62"
summary: "Techniques for processing and analyzing natural language text."
---

# Natural Language Processing: Text Processing

Natural language processing (NLP) is a field at the intersection of computer science, linguistics, and machine learning. This note covers the foundational text processing techniques.

## Tokenization

Tokenization is the process of breaking text into smaller units called tokens. These can be words, subwords, or characters.

### Word Tokenization
Split text on whitespace and punctuation. Simple but has issues with contractions, hyphenated words, and languages without clear word boundaries.

### Subword Tokenization
- **Byte Pair Encoding (BPE)**: Iteratively merges the most frequent character pairs
- **WordPiece**: Used by BERT, similar to BPE but uses likelihood instead of frequency
- **SentencePiece**: Language-agnostic, treats input as raw unicode

## Stemming and Lemmatization

**Stemming** reduces words to their root form using heuristic rules. The Porter Stemmer is the most widely used English stemmer.

**Lemmatization** reduces words to their dictionary form (lemma) using morphological analysis. More accurate but slower than stemming.

## Stop Word Removal

Common words like "the", "is", "at" are often removed as they carry little semantic meaning. However, some NLP tasks benefit from keeping them.

## TF-IDF

Term Frequency-Inverse Document Frequency is a statistical measure of word importance in a document relative to a corpus.

$$\text{TF-IDF}(t, d, D) = \text{TF}(t, d) \times \text{IDF}(t, D)$$

Where:
- TF(t, d) = frequency of term t in document d
- IDF(t, D) = log(N / |{d in D : t in d}|)

## BM25

BM25 (Best Matching 25) is a ranking function used in information retrieval. It improves upon TF-IDF by adding document length normalization and term frequency saturation.

## Named Entity Recognition

NER identifies and classifies named entities in text into categories like person names, organizations, locations, and dates.

## Text Embeddings

Modern NLP represents text as dense vectors (embeddings) that capture semantic meaning. Word2Vec, GloVe, and contextual embeddings from transformers are commonly used approaches.

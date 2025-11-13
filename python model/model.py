# train_model.py
# pip install scikit-learn pandas tldextract

import pandas as pd
import numpy as np
import json
import tldextract
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score

def has_ip(host):
    import re
    return int(bool(re.match(r'^\d{1,3}(\.\d{1,3}){3}$', host) or re.search(r'\[[0-9a-fA-F:]+\]', host)))

def count_suspicious_words(url):
    words = ['login','secure','account','update','verify','bank','confirm','webscr','ebayisapi']
    u = url.lower()
    return sum(w in u for w in words)

def count_at_symbols(url):
    return url.count('@')

def count_subdomains(host):
    parts = host.split('.')
    return max(0, len(parts)-2)  # -2 to ignore domain + tld (rough)

def external_anchors_count(html, current_host=None):
    # For offline dataset we may not have HTML. If the dataset has features include them.
    return 0

def has_password_field(html):
    return 0

def uses_https(url):
    return 0 if url.startswith('https://') else 1

def url_length(url):
    return len(url)

def title_length(title):
    return len(title or "")

def extract_features_from_row(row):
    url = row['url']
    try:
        parsed = tldextract.extract(url)
        host = '.'.join(p for p in [parsed.subdomain, parsed.domain, parsed.suffix] if p)
    except Exception:
        from urllib.parse import urlparse
        host = urlparse(url).hostname or ''
    return [
        has_ip(host),
        count_subdomains(host),
        count_suspicious_words(url),
        count_at_symbols(url),
        0,  # external anchors (not available)
        0,  # password field (not available)
        uses_https(url),
        url_length(url),
        0   # title length (if available)
    ]

def main():
    df = pd.read_csv('phishing_dataset.csv')  # user-supplied
    # expected columns: 'url' and 'label' (1 phishing, 0 legitimate)
    rows = df.to_dict(orient='records')
    X = np.array([extract_features_from_row(r) for r in rows])
    y = df['label'].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    clf = LogisticRegression(max_iter=1000)
    clf.fit(X_train, y_train)

    y_pred = clf.predict_proba(X_test)[:,1]
    print('ROC AUC:', roc_auc_score(y_test, y_pred))
    print('Accuracy (threshold 0.5):', accuracy_score(y_test, (y_pred>=0.5).astype(int)))

    model_json = {
        'coefs': clf.coef_.flatten().tolist(),
        'intercept': float(clf.intercept_[0]),
        'threshold': 0.5,
        'feature_names': [
            'has_ip', 'subdomain_count', 'suspicious_words', 'at_symbols',
            'external_anchors', 'has_password_field', 'not_https', 'url_length', 'title_length'
        ]
    }
    with open('model.json','w') as f:
        json.dump(model_json, f, indent=2)
    print('Saved model.json')

if __name__ == '__main__':
    main()


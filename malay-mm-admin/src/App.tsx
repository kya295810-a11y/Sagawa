import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

type Page = 'dashboard' | 'news' | 'services' | 'exchange';

type ModalMode =
  | 'none'
  | 'newsForm'
  | 'newsPreview'
  | 'newsDelete'
  | 'serviceForm'
  | 'servicePreview'
  | 'serviceDelete'
  | 'exchangePreview';

type NewsItem = {
  id: number;
  title: string;
  description: string;
  image: string;
  video: string;
  published: boolean;
  date: string;
};

type ServiceItem = {
  id: number;
  title: string;
  description: string;
  image: string;
  imageName: string;
  phone: string;
  website: string;
  location: string;
  published: boolean;
};

type ExchangeItem = {
  currency: string;
  name: string;
  buy: string;
  sell: string;
};

const initialNews: NewsItem[] = [
  {
    id: 1,
    title: 'Malaysia–Myanmar Community Update',
    description:
      'Latest useful information and updates for the Malaysia–Myanmar community.',
    image:
      'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85',
    video: '',
    published: true,
    date: '24 Aug 2026',
  },
  {
    id: 2,
    title: 'Important Community Information',
    description:
      'Important information and useful updates for Myanmar people living in Malaysia.',
    image:
      'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=1200&q=85',
    video: '',
    published: true,
    date: '23 Aug 2026',
  },
];

const initialServices: ServiceItem[] = [
  {
    id: 1,
    title: 'Healthcare Services',
    description:
      'Find useful healthcare information and services for the Malaysia–Myanmar community.',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=85',
    imageName: 'healthcare.jpg',
    phone: '+60 00-000 0000',
    website: 'https://example.com',
    location: 'Malaysia',
    published: true,
  },
  {
    id: 2,
    title: 'Jobs & Employment',
    description:
      'Discover job opportunities and useful employment resources.',
    image:
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',
    imageName: 'jobs.jpg',
    phone: '',
    website: '',
    location: 'Malaysia',
    published: true,
  },
];

const API_BASE = 'http://localhost:3000';

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected file.'));
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Could not read the selected file.'));
    };

    reader.readAsDataURL(file);
  });

const initialExchange: ExchangeItem[] = [
  {
    currency: 'MYR → MMK',
    name: 'Malaysian Ringgit',
    buy: '950',
    sell: '965',
  },
  {
    currency: 'USD → MMK',
    name: 'US Dollar',
    buy: '4,450',
    sell: '4,500',
  },
];

function App() {
  const [activePage, setActivePage] =
    useState<Page>('dashboard');

  const [modal, setModal] =
    useState<ModalMode>('none');

  const [news, setNews] =
    useState<NewsItem[]>(initialNews);

  const [services, setServices] =
    useState<ServiceItem[]>(initialServices);

  const [exchangeRates, setExchangeRates] =
    useState<ExchangeItem[]>(initialExchange);

  const [searchNews, setSearchNews] =
    useState('');

  const [searchServices, setSearchServices] =
    useState('');

  const [editingNewsId, setEditingNewsId] =
    useState<number | null>(null);

  const [editingServiceId, setEditingServiceId] =
    useState<number | null>(null);

  const [deleteNewsId, setDeleteNewsId] =
    useState<number | null>(null);

  const [deleteServiceId, setDeleteServiceId] =
    useState<number | null>(null);

  const [previewNews, setPreviewNews] =
    useState<NewsItem | null>(null);

  const [previewService, setPreviewService] =
    useState<ServiceItem | null>(null);

  /* =========================================================
     NEWS DRAFT
  ========================================================= */

  const [newsTitle, setNewsTitle] =
    useState('');

  const [newsDescription, setNewsDescription] =
    useState('');

  const [newsPublished, setNewsPublished] =
    useState(true);

  const [newsImageFile, setNewsImageFile] =
    useState<File | null>(null);

  const [newsImagePreview, setNewsImagePreview] =
    useState('');

  const [newsVideoFile, setNewsVideoFile] =
    useState<File | null>(null);

  const [newsVideoPreview, setNewsVideoPreview] =
    useState('');

  /* =========================================================
     SERVICE DRAFT
  ========================================================= */

  const [serviceTitle, setServiceTitle] =
    useState('');

  const [serviceDescription, setServiceDescription] =
    useState('');

  const [servicePhone, setServicePhone] =
    useState('');

  const [serviceWebsite, setServiceWebsite] =
    useState('');

  const [serviceLocation, setServiceLocation] =
    useState('');

  const [servicePublished, setServicePublished] =
    useState(true);

  const [serviceImagePreview, setServiceImagePreview] =
    useState('');

  const [serviceImageName, setServiceImageName] =
    useState('');

  /* =========================================================
     EXCHANGE DRAFT
  ========================================================= */

  const [exchangeDraft, setExchangeDraft] =
    useState<ExchangeItem[]>(initialExchange);

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  /* =========================================================
     API
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadNews = async () => {
      try {
        setApiLoading(true);
        setApiError('');

        const response = await fetch(`${API_BASE}/api/news`);

        if (!response.ok) {
          throw new Error(`News API returned ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error('Invalid news API response.');
        }

        if (!cancelled) {
          setNews(result.data);
        }
      } catch (error) {
        console.error('Failed to load news:', error);

        if (!cancelled) {
          setApiError(
            'Local API is not available. Start the server on port 3000.'
          );
        }
      } finally {
        if (!cancelled) {
          setApiLoading(false);
        }
      }
    };

    loadNews();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
     MENU
  ========================================================= */

  const menuItems = [
    {
      id: 'dashboard' as Page,
      label: 'Dashboard',
      icon: '⌂',
    },
    {
      id: 'news' as Page,
      label: 'News',
      icon: '▤',
    },
    {
      id: 'services' as Page,
      label: 'Services',
      icon: '▦',
    },
    {
      id: 'exchange' as Page,
      label: 'Exchange Rate',
      icon: '$',
    },
  ];

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredNews = useMemo(() => {
    const value = searchNews.trim().toLowerCase();

    if (!value) {
      return news;
    }

    return news.filter((item) =>
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(value)
    );
  }, [news, searchNews]);

  const filteredServices = useMemo(() => {
    const value =
      searchServices.trim().toLowerCase();

    if (!value) {
      return services;
    }

    return services.filter((item) =>
      `${item.title} ${item.description} ${item.location}`
        .toLowerCase()
        .includes(value)
    );
  }, [services, searchServices]);

  /* =========================================================
     MODAL
  ========================================================= */

  const closeModal = () => {
    setModal('none');
  };

  /* =========================================================
     NEWS
  ========================================================= */

  const openAddNews = () => {
    setEditingNewsId(null);

    setNewsTitle('');
    setNewsDescription('');
    setNewsPublished(true);

    setNewsImageFile(null);
    setNewsImagePreview('');

    setNewsVideoFile(null);
    setNewsVideoPreview('');

    setModal('newsForm');
  };

  const openEditNews = (item: NewsItem) => {
    setEditingNewsId(item.id);

    setNewsTitle(item.title);
    setNewsDescription(item.description);
    setNewsPublished(item.published);

    setNewsImageFile(null);
    setNewsImagePreview(item.image);

    setNewsVideoFile(null);
    setNewsVideoPreview(item.video);

    setModal('newsForm');
  };

  const handleNewsImage = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);

      setNewsImageFile(file);
      setNewsImagePreview(dataUrl);
    } catch (error) {
      console.error('Image read error:', error);
      alert('Could not read the selected image.');
    }
  };

  const handleNewsVideo = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      alert('Please choose a video file.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);

      setNewsVideoFile(file);
      setNewsVideoPreview(dataUrl);
    } catch (error) {
      console.error('Video read error:', error);
      alert('Could not read the selected video.');
    }
  };

  const previewNewsDraft = () => {
    const title = newsTitle.trim();
    const description =
      newsDescription.trim();

    if (!title) {
      alert('Please enter a news title.');
      return;
    }

    if (!description) {
      alert(
        'Please enter a news description.'
      );
      return;
    }

    const existingNews = editingNewsId
      ? news.find(
          (item) => item.id === editingNewsId
        )
      : undefined;

    const draft: NewsItem = {
      id: editingNewsId ?? Date.now(),

      title,

      description,

      image:
        newsImagePreview ||
        'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=85',

      video: newsVideoPreview,

      published: newsPublished,

      date:
        existingNews?.date ||
        new Date().toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }
        ),
    };

    setPreviewNews(draft);

    setModal('newsPreview');
  };

  const confirmNews = async () => {
    if (!previewNews) {
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const isEditing = editingNewsId !== null;
      const url = isEditing
        ? `${API_BASE}/api/news/${editingNewsId}`
        : `${API_BASE}/api/news`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewNews),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not save news.'
        );
      }

      const savedItem = result.data as NewsItem;

      if (isEditing) {
        setNews((current) =>
          current.map((item) =>
            item.id === savedItem.id
              ? savedItem
              : item
          )
        );
      } else {
        setNews((current) => [
          savedItem,
          ...current,
        ]);
      }

      setPreviewNews(null);
      setModal('none');
    } catch (error) {
      console.error('Save news error:', error);

      setApiError(
        'Could not save news. Make sure the Local API is running.'
      );
      alert(
        'Could not save news. Please check that the Local API is running.'
      );
    } finally {
      setApiLoading(false);
    }
  };

  const askDeleteNews = (id: number) => {
    setDeleteNewsId(id);
    setModal('newsDelete');
  };

  const confirmDeleteNews = async () => {
    if (deleteNewsId === null) {
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const response = await fetch(
        `${API_BASE}/api/news/${deleteNewsId}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not delete news.'
        );
      }

      setNews((current) =>
        current.filter(
          (item) => item.id !== deleteNewsId
        )
      );

      setDeleteNewsId(null);
      setModal('none');
    } catch (error) {
      console.error('Delete news error:', error);

      setApiError(
        'Could not delete news. Make sure the Local API is running.'
      );
      alert(
        'Could not delete news. Please check that the Local API is running.'
      );
    } finally {
      setApiLoading(false);
    }
  };

  const toggleNewsPublished = async (id: number) => {
    const item = news.find((newsItem) => newsItem.id === id);

    if (!item) {
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const response = await fetch(
        `${API_BASE}/api/news/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            published: !item.published,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not update publish status.'
        );
      }

      setNews((current) =>
        current.map((currentItem) =>
          currentItem.id === id
            ? result.data
            : currentItem
        )
      );
    } catch (error) {
      console.error('Publish status error:', error);

      setApiError(
        'Could not update publish status. Make sure the Local API is running.'
      );
      alert(
        'Could not update publish status. Please check that the Local API is running.'
      );
    } finally {
      setApiLoading(false);
    }
  };

  /* =========================================================
     SERVICES
  ========================================================= */

  const openAddService = () => {
    if (services.length >= 25) {
      alert(
        'You can have a maximum of 25 services.'
      );
      return;
    }

    setEditingServiceId(null);

    setServiceTitle('');
    setServiceDescription('');
    setServicePhone('');
    setServiceWebsite('');
    setServiceLocation('');
    setServicePublished(true);

    setServiceImagePreview('');
    setServiceImageName('');

    setModal('serviceForm');
  };

  const openEditService = (
    item: ServiceItem
  ) => {
    setEditingServiceId(item.id);

    setServiceTitle(item.title);
    setServiceDescription(item.description);
    setServicePhone(item.phone);
    setServiceWebsite(item.website);
    setServiceLocation(item.location);
    setServicePublished(item.published);

    setServiceImagePreview(item.image);
    setServiceImageName(item.imageName);

    setModal('serviceForm');
  };

  const handleServiceImage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }

    setServiceImagePreview(
      URL.createObjectURL(file)
    );

    setServiceImageName(file.name);
  };

  const previewServiceDraft = () => {
    const title = serviceTitle.trim();
    const description =
      serviceDescription.trim();

    if (!title) {
      alert('Please enter a service title.');
      return;
    }

    if (!description) {
      alert(
        'Please enter a service description.'
      );
      return;
    }

    const draft: ServiceItem = {
      id: editingServiceId ?? Date.now(),

      title,

      description,

      image:
        serviceImagePreview ||
        'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',

      imageName:
        serviceImageName || 'service-image',

      phone: servicePhone.trim(),

      website: serviceWebsite.trim(),

      location: serviceLocation.trim(),

      published: servicePublished,
    };

    setPreviewService(draft);

    setModal('servicePreview');
  };

  const confirmService = () => {
    if (!previewService) {
      return;
    }

    if (editingServiceId !== null) {
      setServices((current) =>
        current.map((item) =>
          item.id === editingServiceId
            ? previewService
            : item
        )
      );
    } else {
      if (services.length >= 25) {
        alert(
          'You can have a maximum of 25 services.'
        );
        return;
      }

      setServices((current) => [
        previewService,
        ...current,
      ]);
    }

    setPreviewService(null);
    setModal('none');
  };

  const askDeleteService = (id: number) => {
    setDeleteServiceId(id);
    setModal('serviceDelete');
  };

  const confirmDeleteService = () => {
    if (deleteServiceId === null) {
      return;
    }

    setServices((current) =>
      current.filter(
        (item) => item.id !== deleteServiceId
      )
    );

    setDeleteServiceId(null);
    setModal('none');
  };

  /* =========================================================
     EXCHANGE
  ========================================================= */

  const updateExchange = (
    index: number,
    field: keyof ExchangeItem,
    value: string
  ) => {
    setExchangeDraft((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const openExchangePreview = () => {
    setModal('exchangePreview');
  };

  const confirmExchange = () => {
    setExchangeRates(exchangeDraft);
    setModal('none');
  };

  /* =========================================================
     DASHBOARD
  ========================================================= */

  const renderDashboard = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            MALAY MM ADMIN
          </span>

          <h1>Dashboard</h1>

          <p>
            Manage your mobile app content
            from one secure place.
          </p>
        </div>

        <div className="admin-avatar">
          A
        </div>
      </div>

      <div className="stats-grid">
        <button
          className="stat-card"
          onClick={() =>
            setActivePage('news')
          }
        >
          <div className="stat-top">
            <div className="stat-icon blue">
              📰
            </div>

            <span className="stat-arrow">
              →
            </span>
          </div>

          <strong>News</strong>

          <span>
            Manage news content
          </span>

          <b>{news.length}</b>
        </button>

        <button
          className="stat-card"
          onClick={() =>
            setActivePage('services')
          }
        >
          <div className="stat-top">
            <div className="stat-icon green">
              🛠️
            </div>

            <span className="stat-arrow">
              →
            </span>
          </div>

          <strong>Services</strong>

          <span>
            Manage community services
          </span>

          <b>{services.length}/25</b>
        </button>

        <button
          className="stat-card"
          onClick={() =>
            setActivePage('exchange')
          }
        >
          <div className="stat-top">
            <div className="stat-icon purple">
              💱
            </div>

            <span className="stat-arrow">
              →
            </span>
          </div>

          <strong>Exchange Rate</strong>

          <span>
            Manage current rates
          </span>

          <b>Live</b>
        </button>
      </div>

      <div className="overview-card">
        <div>
          <span className="eyebrow">
            CONTENT STATUS
          </span>

          <h2>
            Current overview
          </h2>
        </div>

        <div className="overview-list">
          <div>
            <span>
              Published News
            </span>

            <strong>
              {
                news.filter(
                  (item) => item.published
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Published Services
            </span>

            <strong>
              {
                services.filter(
                  (item) => item.published
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Exchange Pairs
            </span>

            <strong>
              {exchangeRates.length}
            </strong>
          </div>
        </div>
      </div>
    </>
  );

  /* =========================================================
     NEWS PAGE
  ========================================================= */

  const renderNewsPage = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            CONTENT MANAGEMENT
          </span>

          <h1>News</h1>

          <p>
            Create, preview and manage
            mobile news.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openAddNews}
        >
          <span>+</span>
          Add News
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span>⌕</span>

          <input
            value={searchNews}
            onChange={(event) =>
              setSearchNews(
                event.target.value
              )
            }
            placeholder="Search news..."
          />

          {searchNews && (
            <button
              className="clear-button"
              onClick={() =>
                setSearchNews('')
              }
            >
              ×
            </button>
          )}
        </div>

        <span className="toolbar-count">
          {filteredNews.length} articles
        </span>
      </div>

      <div className="content-panel">
        <div className="panel-header">
          <div>
            <strong>
              All News
            </strong>

            <span>
              Maximum 10 displayed in mobile app
            </span>
          </div>

          <span className="soft-badge">
            {news.length} total
          </span>
        </div>

        <div className="news-list">
          {filteredNews.length === 0 ? (
            <div className="empty-state">
              <strong>
                No news found
              </strong>

              <span>
                Try another search or add
                a new article.
              </span>
            </div>
          ) : (
            filteredNews.map((item) => (
              <div
                className="news-card"
                key={item.id}
              >
                <img
                  src={item.image}
                  alt=""
                />

                <div className="news-card-main">
                  <div className="news-card-title-row">
                    <strong>
                      {item.title}
                    </strong>

                    <button
                      className={
                        item.published
                          ? 'status-badge published'
                          : 'status-badge draft'
                      }
                      onClick={() =>
                        toggleNewsPublished(
                          item.id
                        )
                      }
                    >
                      ●{' '}
                      {item.published
                        ? 'Published'
                        : 'Draft'}
                    </button>
                  </div>

                  <p>
                    {item.description}
                  </p>

                  <span className="news-date">
                    {item.date}
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    className="icon-action"
                    onClick={() => {
                      setPreviewNews(item);
                      setModal(
                        'newsPreview'
                      );
                    }}
                    title="Preview"
                  >
                    👁
                  </button>

                  <button
                    className="icon-action"
                    onClick={() =>
                      openEditNews(item)
                    }
                    title="Edit"
                  >
                    ✎
                  </button>

                  <button
                    className="icon-action danger"
                    onClick={() =>
                      askDeleteNews(item.id)
                    }
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  /* =========================================================
     SERVICES PAGE
  ========================================================= */

  const renderServicesPage = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            SERVICE MANAGEMENT
          </span>

          <h1>Services</h1>

          <p>
            Manage up to 25 services shown
            in the mobile app.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={services.length >= 25}
          onClick={openAddService}
        >
          <span>+</span>
          Add Service
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span>⌕</span>

          <input
            value={searchServices}
            onChange={(event) =>
              setSearchServices(
                event.target.value
              )
            }
            placeholder="Search services..."
          />

          {searchServices && (
            <button
              className="clear-button"
              onClick={() =>
                setSearchServices('')
              }
            >
              ×
            </button>
          )}
        </div>

        <span className="toolbar-count">
          {services.length}/25 services
        </span>
      </div>

      <div className="content-panel">
        <div className="panel-header">
          <div>
            <strong>
              All Services
            </strong>

            <span>
              No categories — simple content
            </span>
          </div>

          <span className="soft-badge">
            {services.length}/25
          </span>
        </div>

        <div className="service-grid">
          {filteredServices.length === 0 ? (
            <div className="empty-state">
              <strong>
                No services found
              </strong>

              <span>
                Try another search or add
                a service.
              </span>
            </div>
          ) : (
            filteredServices.map((item) => (
              <div
                className="service-card"
                key={item.id}
              >
                <div className="service-image-wrap">
                  <img
                    src={item.image}
                    alt=""
                  />

                  <span
                    className={
                      item.published
                        ? 'image-status live'
                        : 'image-status'
                    }
                  >
                    {item.published
                      ? 'LIVE'
                      : 'DRAFT'}
                  </span>
                </div>

                <div className="service-card-body">
                  <div className="service-title-row">
                    <strong>
                      {item.title}
                    </strong>

                    <span>
                      {item.location}
                    </span>
                  </div>

                  <p>
                    {item.description}
                  </p>

                  <div className="service-card-footer">
                    <button
                      className="small-action"
                      onClick={() => {
                        setPreviewService(
                          item
                        );

                        setModal(
                          'servicePreview'
                        );
                      }}
                    >
                      Preview
                    </button>

                    <button
                      className="small-action"
                      onClick={() =>
                        openEditService(item)
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="small-action danger-text"
                      onClick={() =>
                        askDeleteService(
                          item.id
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  /* =========================================================
     EXCHANGE PAGE
  ========================================================= */

  const renderExchangePage = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            FINANCIAL CONTENT
          </span>

          <h1>Exchange Rate</h1>

          <p>
            Update rates and review changes
            before saving.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openExchangePreview}
        >
          Review Changes
        </button>
      </div>

      <div className="exchange-panel">
        <div className="exchange-header">
          <div>
            <strong>
              Current Exchange Rates
            </strong>

            <span>
              Changes are only applied after confirmation.
            </span>
          </div>

          <span className="soft-badge">
            Admin controlled
          </span>
        </div>

        <div className="exchange-table">
          <div className="exchange-table-head">
            <span>PAIR</span>
            <span>NAME</span>
            <span>BUY</span>
            <span>SELL</span>
          </div>

          {exchangeDraft.map(
            (item, index) => (
              <div
                className="exchange-row"
                key={`${item.currency}-${index}`}
              >
                <strong>
                  {item.currency}
                </strong>

                <span>
                  {item.name}
                </span>

                <input
                  value={item.buy}
                  onChange={(event) =>
                    updateExchange(
                      index,
                      'buy',
                      event.target.value
                    )
                  }
                  inputMode="decimal"
                />

                <input
                  value={item.sell}
                  onChange={(event) =>
                    updateExchange(
                      index,
                      'sell',
                      event.target.value
                    )
                  }
                  inputMode="decimal"
                />
              </div>
            )
          )}
        </div>

        <div className="exchange-footer">
          <span>
            Edit values, then preview
            before saving.
          </span>

          <button
            className="primary-button"
            onClick={openExchangePreview}
          >
            Preview & Confirm
          </button>
        </div>
      </div>
    </>
  );

  /* =========================================================
     NEWS FORM MODAL
  ========================================================= */

  const renderNewsFormModal = () => (
    <div className="modal-overlay">
      <div className="modal-card large-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {editingNewsId
                ? 'EDIT NEWS'
                : 'NEW NEWS'}
            </span>

            <h2>
              {editingNewsId
                ? 'Edit News'
                : 'Create News'}
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <div className="form-section">
          <label>
            News Title
          </label>

          <input
            className="form-input"
            value={newsTitle}
            onChange={(event) =>
              setNewsTitle(
                event.target.value
              )
            }
            placeholder="Enter news title"
            autoComplete="off"
          />

          <label>
            Description
          </label>

          <textarea
            className="form-textarea"
            value={newsDescription}
            onChange={(event) =>
              setNewsDescription(
                event.target.value
              )
            }
            placeholder="Write your news description..."
            rows={6}
          />
        </div>

        <div className="media-grid">
          <div className="upload-card">
            <div className="upload-card-top">
              <div>
                <strong>
                  News Image
                </strong>

                <span>
                  JPG, PNG, WEBP
                </span>
              </div>

              <span className="upload-symbol">
                🖼️
              </span>
            </div>

            <label className="upload-button">
              Choose Image

              <input
                type="file"
                accept="image/*"
                onChange={
                  handleNewsImage
                }
              />
            </label>

            {newsImagePreview && (
              <div className="preview-media">
                <img
                  src={newsImagePreview}
                  alt="News preview"
                />

                <button
                  type="button"
                  onClick={() => {
                    setNewsImageFile(null);
                    setNewsImagePreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {newsImageFile && (
              <small>
                Selected: {newsImageFile.name}
              </small>
            )}
          </div>

          <div className="upload-card">
            <div className="upload-card-top">
              <div>
                <strong>
                  News Video
                </strong>

                <span>
                  MP4, MOV, WEBM
                </span>
              </div>

              <span className="upload-symbol">
                🎬
              </span>
            </div>

            <label className="upload-button">
              Choose Video

              <input
                type="file"
                accept="video/*"
                onChange={
                  handleNewsVideo
                }
              />
            </label>

            {newsVideoPreview && (
              <div className="preview-media">
                <video
                  src={newsVideoPreview}
                  controls
                  preload="metadata"
                />

                <button
                  type="button"
                  onClick={() => {
                    setNewsVideoFile(null);
                    setNewsVideoPreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {newsVideoFile && (
              <small>
                Selected: {newsVideoFile.name}
              </small>
            )}
          </div>
        </div>

        <div className="publish-setting">
          <div>
            <strong>
              Publish status
            </strong>

            <span>
              Published content appears
              in the mobile app.
            </span>
          </div>

          <button
            type="button"
            className={
              newsPublished
                ? 'toggle active'
                : 'toggle'
            }
            onClick={() =>
              setNewsPublished(
                !newsPublished
              )
            }
          >
            <span />
          </button>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={closeModal}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={
              previewNewsDraft
            }
          >
            Preview Changes →
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================
     NEWS PREVIEW
  ========================================================= */

  const renderNewsPreviewModal = () => (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              REVIEW BEFORE SAVING
            </span>

            <h2>
              News Preview
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        {previewNews && (
          <>
            <div className="review-banner">
              <span>✓</span>

              <div>
                <strong>
                  Review your changes
                </strong>

                <small>
                  Nothing has been saved yet.
                </small>
              </div>
            </div>

            {previewNews.image && (
              <img
                className="large-preview-image"
                src={previewNews.image}
                alt=""
              />
            )}

            <div className="preview-content">
              <div className="preview-status-row">
                <span>
                  NEWS
                </span>

                <span
                  className={
                    previewNews.published
                      ? 'status-badge published'
                      : 'status-badge draft'
                  }
                >
                  {previewNews.published
                    ? 'Published'
                    : 'Draft'}
                </span>
              </div>

              <h3>
                {previewNews.title}
              </h3>

              <p>
                {previewNews.description}
              </p>

              {previewNews.video && (
                <video
                  className="large-preview-video"
                  src={previewNews.video}
                  controls
                />
              )}
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setModal('newsForm')
                }
              >
                ← Back & Edit
              </button>

              <button
                className="confirm-button"
                onClick={
                  confirmNews
                }
              >
                ✓ Confirm & Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* =========================================================
     NEWS DELETE
  ========================================================= */

  const renderNewsDeleteModal = () => {
    const item = news.find(
      (newsItem) =>
        newsItem.id === deleteNewsId
    );

    return (
      <div className="modal-overlay">
        <div className="modal-card confirm-modal">
          <div className="danger-circle">
            🗑
          </div>

          <span className="eyebrow">
            DESTRUCTIVE ACTION
          </span>

          <h2>
            Delete this news?
          </h2>

          <p>
            You are about to delete
            <strong>
              {' '}
              “{item?.title}”
            </strong>
            .
          </p>

          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              className="danger-button"
              onClick={
                confirmDeleteNews
              }
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* =========================================================
     SERVICE FORM
  ========================================================= */

  const renderServiceFormModal = () => (
    <div className="modal-overlay">
      <div className="modal-card large-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {editingServiceId
                ? 'EDIT SERVICE'
                : 'NEW SERVICE'}
            </span>

            <h2>
              {editingServiceId
                ? 'Edit Service'
                : 'Create Service'}
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <div className="form-section">
          <label>
            Service Title
          </label>

          <input
            className="form-input"
            value={serviceTitle}
            onChange={(event) =>
              setServiceTitle(
                event.target.value
              )
            }
            placeholder="Enter service title"
            autoComplete="off"
          />

          <label>
            Description
          </label>

          <textarea
            className="form-textarea"
            value={serviceDescription}
            onChange={(event) =>
              setServiceDescription(
                event.target.value
              )
            }
            placeholder="Describe this service..."
            rows={5}
          />

          <div className="two-column-form">
            <div>
              <label>
                Phone
              </label>

              <input
                className="form-input"
                value={servicePhone}
                onChange={(event) =>
                  setServicePhone(
                    event.target.value
                  )
                }
                placeholder="+60..."
                autoComplete="off"
              />
            </div>

            <div>
              <label>
                Location
              </label>

              <input
                className="form-input"
                value={serviceLocation}
                onChange={(event) =>
                  setServiceLocation(
                    event.target.value
                  )
                }
                placeholder="Malaysia"
                autoComplete="off"
              />
            </div>
          </div>

          <label>
            Website
          </label>

          <input
            className="form-input"
            value={serviceWebsite}
            onChange={(event) =>
              setServiceWebsite(
                event.target.value
              )
            }
            placeholder="https://..."
            autoComplete="off"
          />
        </div>

        <div className="upload-card">
          <div className="upload-card-top">
            <div>
              <strong>
                Service Image
              </strong>

              <span>
                JPG, PNG, WEBP
              </span>
            </div>

            <span className="upload-symbol">
              🖼️
            </span>
          </div>

          <label className="upload-button">
            Choose Image

            <input
              type="file"
              accept="image/*"
              onChange={
                handleServiceImage
              }
            />
          </label>

          {serviceImagePreview && (
            <div className="preview-media">
              <img
                src={serviceImagePreview}
                alt="Service preview"
              />

              <button
                type="button"
                onClick={() => {
                  setServiceImagePreview('');
                  setServiceImageName('');
                }}
              >
                Remove
              </button>
            </div>
          )}

          {serviceImageName && (
            <small>
              Selected: {serviceImageName}
            </small>
          )}
        </div>

        <div className="publish-setting">
          <div>
            <strong>
              Publish status
            </strong>

            <span>
              Published services appear
              in the mobile app.
            </span>
          </div>

          <button
            type="button"
            className={
              servicePublished
                ? 'toggle active'
                : 'toggle'
            }
            onClick={() =>
              setServicePublished(
                !servicePublished
              )
            }
          >
            <span />
          </button>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={closeModal}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={
              previewServiceDraft
            }
          >
            Preview Changes →
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================
     SERVICE PREVIEW
  ========================================================= */

  const renderServicePreviewModal = () => (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              REVIEW BEFORE SAVING
            </span>

            <h2>
              Service Preview
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        {previewService && (
          <>
            <div className="review-banner">
              <span>✓</span>

              <div>
                <strong>
                  Review your changes
                </strong>

                <small>
                  Nothing has been saved yet.
                </small>
              </div>
            </div>

            <img
              className="large-preview-image"
              src={previewService.image}
              alt=""
            />

            <div className="preview-content">
              <div className="preview-status-row">
                <span>
                  SERVICE
                </span>

                <span
                  className={
                    previewService.published
                      ? 'status-badge published'
                      : 'status-badge draft'
                  }
                >
                  {previewService.published
                    ? 'Published'
                    : 'Draft'}
                </span>
              </div>

              <h3>
                {previewService.title}
              </h3>

              <p>
                {previewService.description}
              </p>

              <div className="detail-list">
                {previewService.phone && (
                  <div>
                    <span>
                      Phone
                    </span>

                    <strong>
                      {previewService.phone}
                    </strong>
                  </div>
                )}

                {previewService.website && (
                  <div>
                    <span>
                      Website
                    </span>

                    <strong>
                      {previewService.website}
                    </strong>
                  </div>
                )}

                {previewService.location && (
                  <div>
                    <span>
                      Location
                    </span>

                    <strong>
                      {previewService.location}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setModal('serviceForm')
                }
              >
                ← Back & Edit
              </button>

              <button
                className="confirm-button"
                onClick={
                  confirmService
                }
              >
                ✓ Confirm & Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* =========================================================
     SERVICE DELETE
  ========================================================= */

  const renderServiceDeleteModal = () => {
    const item = services.find(
      (service) =>
        service.id === deleteServiceId
    );

    return (
      <div className="modal-overlay">
        <div className="modal-card confirm-modal">
          <div className="danger-circle">
            🗑
          </div>

          <span className="eyebrow">
            DESTRUCTIVE ACTION
          </span>

          <h2>
            Delete this service?
          </h2>

          <p>
            You are about to delete
            <strong>
              {' '}
              “{item?.title}”
            </strong>
            .
          </p>

          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              className="danger-button"
              onClick={
                confirmDeleteService
              }
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* =========================================================
     EXCHANGE PREVIEW
  ========================================================= */

  const renderExchangePreviewModal = () => (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              REVIEW BEFORE SAVING
            </span>

            <h2>
              Exchange Rate Preview
            </h2>
          </div>

          <button
            className="modal-close"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <div className="review-banner">
          <span>✓</span>

          <div>
            <strong>
              Review all rate changes
            </strong>

            <small>
              Nothing has been saved yet.
            </small>
          </div>
        </div>

        <div className="rate-review">
          {exchangeDraft.map(
            (item, index) => {
              const old =
                exchangeRates[index];

              return (
                <div
                  className="rate-review-row"
                  key={`${item.currency}-${index}`}
                >
                  <div>
                    <strong>
                      {item.currency}
                    </strong>

                    <span>
                      {item.name}
                    </span>
                  </div>

                  <div className="rate-values">
                    <div>
                      <small>
                        BUY
                      </small>

                      <span>
                        {old?.buy}
                      </span>

                      <b>
                        →
                      </b>

                      <strong>
                        {item.buy}
                      </strong>
                    </div>

                    <div>
                      <small>
                        SELL
                      </small>

                      <span>
                        {old?.sell}
                      </span>

                      <b>
                        →
                      </b>

                      <strong>
                        {item.sell}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={closeModal}
          >
            ← Back & Edit
          </button>

          <button
            className="confirm-button"
            onClick={
              confirmExchange
            }
          >
            ✓ Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================
     PAGE
  ========================================================= */

  const renderPage = () => {
    switch (activePage) {
      case 'news':
        return renderNewsPage();

      case 'services':
        return renderServicesPage();

      case 'exchange':
        return renderExchangePage();

      default:
        return renderDashboard();
    }
  };

  /* =========================================================
     APP
  ========================================================= */

  return (
    <div className="admin-app">

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            MM
          </div>

          <div>
            <strong>
              Malay MM
            </strong>

            <span>
              Admin
            </span>
          </div>
        </div>

        <nav className="navigation">
          <span className="nav-label">
            MANAGEMENT
          </span>

          {menuItems.map((item) => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? 'nav-item active'
                  : 'nav-item'
              }
              onClick={() =>
                setActivePage(item.id)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            type="button"
          >
            <span className="nav-icon">
              ⚙
            </span>

            <span>
              Settings
            </span>
          </button>

          <div className="admin-user">
            <div className="user-avatar">
              A
            </div>

            <div>
              <strong>
                Administrator
              </strong>

              <span>
                Admin account
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="topbar-label">
              MALAY MM PROJECT
            </span>

            <span className="system-status">
              ● System ready
            </span>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
            >
              🔔
            </button>

            <button
              className="profile-button"
              type="button"
            >
              <span className="profile-avatar">
                A
              </span>

              <span>
                Admin
              </span>

              <span>
                ⌄
              </span>
            </button>
          </div>
        </header>

        <section className="content">
          {apiError && (
            <div
              className="review-banner"
              style={{
                marginBottom: 16,
                borderColor: '#f1c4c4',
                background: '#fff7f7',
              }}
            >
              <span>!</span>

              <div>
                <strong>Local API connection issue</strong>
                <small>{apiError}</small>
              </div>
            </div>
          )}

          {apiLoading && (
            <div
              style={{
                marginBottom: 12,
                color: '#667085',
                fontSize: 13,
              }}
            >
              Saving / loading content…
            </div>
          )}

          {renderPage()}
        </section>
      </main>

      {modal === 'newsForm' &&
        renderNewsFormModal()}

      {modal === 'newsPreview' &&
        renderNewsPreviewModal()}

      {modal === 'newsDelete' &&
        renderNewsDeleteModal()}

      {modal === 'serviceForm' &&
        renderServiceFormModal()}

      {modal === 'servicePreview' &&
        renderServicePreviewModal()}

      {modal === 'serviceDelete' &&
        renderServiceDeleteModal()}

      {modal === 'exchangePreview' &&
        renderExchangePreviewModal()}
    </div>
  );
}

export default App;
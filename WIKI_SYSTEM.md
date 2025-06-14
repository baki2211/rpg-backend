# Wiki System Documentation

A modular Wiki system for organizing and displaying lore content with hierarchical sections and entries. The system supports markdown content, tagging, search functionality, and admin management.

## Features

- **Hierarchical Content**: Organize content into sections (e.g., Races, Geography) and entries within sections
- **Admin Management**: Complete CRUD operations for sections and entries
- **Public Read-Only Access**: Players can browse, search, and view content
- **Markdown Support**: Rich text content with markdown formatting
- **Tag System**: Cross-reference content with tags
- **SEO-Friendly URLs**: Automatic slug generation for clean URLs
- **View Tracking**: Track how often entries are viewed
- **Search Functionality**: Full-text search across titles, content, and tags

## Database Schema

### WikiSection
- `id`: Primary key
- `name`: Display name (e.g., "Races")
- `slug`: URL-safe identifier (e.g., "races")
- `description`: Optional description
- `position`: Numeric ordering
- `isActive`: Show/hide section
- `createdBy`: Foreign key to users table
- `createdAt`, `updatedAt`: Timestamps

### WikiEntry
- `id`: Primary key
- `sectionId`: Foreign key to wiki_sections
- `title`: Entry title
- `slug`: URL-safe title
- `content`: Full markdown content
- `excerpt`: Auto-generated or manual excerpt
- `tags`: JSON array of tags
- `isPublished`: Publish/draft status
- `position`: Ordering within section
- `viewCount`: Number of views
- `createdBy`: Foreign key to users table
- `createdAt`, `updatedAt`: Timestamps

## Installation

1. **Run the migration** to create the database tables:
```bash
npm run migration:run
```

2. **The system is automatically registered** in `src/index.js` with the route `/api/wiki`

## API Endpoints

### Admin Endpoints (Require admin/master role)

#### Section Management
```http
GET    /api/wiki/admin/sections              # Get all sections
POST   /api/wiki/admin/sections              # Create section
PUT    /api/wiki/admin/sections/:id          # Update section
DELETE /api/wiki/admin/sections/:id          # Delete section
PUT    /api/wiki/admin/sections/reorder      # Reorder sections
```

#### Entry Management
```http
GET    /api/wiki/admin/sections/:sectionId/entries  # Get entries in section
GET    /api/wiki/admin/entries/:id                  # Get specific entry
POST   /api/wiki/admin/entries                      # Create entry
PUT    /api/wiki/admin/entries/:id                  # Update entry
DELETE /api/wiki/admin/entries/:id                  # Delete entry
PUT    /api/wiki/admin/sections/:sectionId/entries/reorder  # Reorder entries
```

#### Utility Endpoints
```http
GET    /api/wiki/admin/stats                # Get wiki statistics
GET    /api/wiki/admin/tags                 # Get all tags
```

### Public Endpoints (No authentication required)

#### Browsing
```http
GET    /api/wiki/navigation                 # Get navigation structure
GET    /api/wiki/sections/:slug             # Get section with entries
GET    /api/wiki/sections/:sectionSlug/entries/:entrySlug  # Get specific entry
```

#### Search and Discovery
```http
GET    /api/wiki/search?q=query&section=id  # Search entries
GET    /api/wiki/tags/:tag/entries          # Get entries by tag
GET    /api/wiki/tags                       # Get all public tags
```

## API Examples

### Creating a Section (Admin)
```http
POST /api/wiki/admin/sections
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Magic System",
  "description": "How magic works in this world",
  "position": 5,
  "isActive": true
}
```

### Creating an Entry (Admin)
```http
POST /api/wiki/admin/entries
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "sectionId": 1,
  "title": "Aether Magic Basics",
  "content": "# Aether Magic\n\nAether is the fundamental magical energy...",
  "excerpt": "An introduction to aether magic",
  "tags": ["magic", "aether", "basics"],
  "isPublished": true
}
```

### Searching Public Content
```http
GET /api/wiki/search?q=magic&section=1
```

### Getting Public Navigation
```http
GET /api/wiki/navigation
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Races",
      "slug": "races",
      "description": "Information about races",
      "entryCount": 3,
      "entries": [
        {
          "id": 1,
          "title": "Elves",
          "slug": "elves",
          "excerpt": "Ancient magical beings..."
        }
      ]
    }
  ]
}
```

## Admin Panel Integration

Add a Wiki management card to your admin panel. Here's an example React component:

```jsx
// AdminWikiCard.jsx
import React, { useState, useEffect } from 'react';

const AdminWikiCard = () => {
  const [stats, setStats] = useState(null);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    fetchWikiStats();
    fetchSections();
  }, []);

  const fetchWikiStats = async () => {
    try {
      const response = await fetch('/api/wiki/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch wiki stats:', error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await fetch('/api/wiki/admin/sections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSections(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error);
    }
  };

  return (
    <div className="admin-card">
      <h3>📚 Wiki Management</h3>
      
      {stats && (
        <div className="stats-grid">
          <div className="stat">
            <strong>{stats.sections}</strong>
            <span>Sections</span>
          </div>
          <div className="stat">
            <strong>{stats.publishedEntries}</strong>
            <span>Published Entries</span>
          </div>
          <div className="stat">
            <strong>{stats.totalViews}</strong>
            <span>Total Views</span>
          </div>
        </div>
      )}

      <div className="actions">
        <button onClick={() => navigate('/admin/wiki/sections')}>
          Manage Sections
        </button>
        <button onClick={() => navigate('/admin/wiki/entries')}>
          Manage Entries
        </button>
        <button onClick={() => navigate('/wiki')}>
          View Public Wiki
        </button>
      </div>

      <div className="recent-sections">
        <h4>Sections</h4>
        <ul>
          {sections.slice(0, 5).map(section => (
            <li key={section.id}>
              <span>{section.name}</span>
              <small>({section.entries?.length || 0} entries)</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminWikiCard;
```

## Frontend Implementation Examples

### Public Wiki Navigation Component
```jsx
// WikiNavigation.jsx
import React, { useState, useEffect } from 'react';

const WikiNavigation = () => {
  const [navigation, setNavigation] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNavigation();
  }, []);

  const fetchNavigation = async () => {
    try {
      const response = await fetch('/api/wiki/navigation');
      const data = await response.json();
      if (data.success) {
        setNavigation(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch navigation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <nav className="wiki-navigation">
      <h2>Lore Wiki</h2>
      {navigation.map(section => (
        <div key={section.id} className="nav-section">
          <h3>
            <Link to={`/wiki/${section.slug}`}>
              {section.name}
            </Link>
            <span className="entry-count">({section.entryCount})</span>
          </h3>
          <ul>
            {section.entries.slice(0, 5).map(entry => (
              <li key={entry.id}>
                <Link to={`/wiki/${section.slug}/${entry.slug}`}>
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
};
```

### Wiki Entry Display Component
```jsx
// WikiEntry.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const WikiEntry = () => {
  const { sectionSlug, entrySlug } = useParams();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntry();
  }, [sectionSlug, entrySlug]);

  const fetchEntry = async () => {
    try {
      const response = await fetch(`/api/wiki/sections/${sectionSlug}/entries/${entrySlug}`);
      const data = await response.json();
      if (data.success) {
        setEntry(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch entry:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!entry) return <div>Entry not found</div>;

  return (
    <article className="wiki-entry">
      <header>
        <h1>{entry.title}</h1>
        <div className="entry-meta">
          <span>Section: {entry.section.name}</span>
          <span>Views: {entry.viewCount}</span>
          <span>Updated: {new Date(entry.updatedAt).toLocaleDateString()}</span>
        </div>
        {entry.tags && entry.tags.length > 0 && (
          <div className="tags">
            {entry.tags.map(tag => (
              <Link key={tag} to={`/wiki/tags/${tag}`} className="tag">
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </header>
      
      <div className="content">
        <ReactMarkdown>{entry.content}</ReactMarkdown>
      </div>
    </article>
  );
};
```

## Content Guidelines

### Section Organization
- **Races**: Character races and their cultures
- **Geography**: Locations, regions, maps
- **History**: Timeline events, wars, eras
- **Organizations**: Guilds, factions, governments
- **Magic System**: How magic works, spell types
- **Notable Figures**: Important NPCs, historical figures

### Writing Tips
- Use markdown for formatting
- Start with a brief introduction
- Use headers to organize content
- Add relevant tags for cross-referencing
- Keep excerpts concise but descriptive
- Include internal links to related entries

### Markdown Examples
```markdown
# Main Header

## Section Header

### Subsection

**Bold text** and *italic text*

- Bullet points
- Another point

1. Numbered lists
2. Second item

[Link to another entry](/wiki/races/elves)

> Blockquotes for important information

`Code or special terms`
```

## Security Notes

- Admin endpoints require `admin` or `master` role
- Public endpoints are open for read-only access
- All user input is validated and sanitized
- Slugs are automatically generated to prevent XSS
- Content supports markdown but HTML is escaped

## Maintenance

### Regular Tasks
- Review and update outdated content
- Monitor view counts to identify popular content
- Clean up unused tags
- Backup content regularly
- Check for broken internal links

### Performance Considerations
- Content is indexed for fast searching
- View counts are updated asynchronously
- Large content should be paginated on frontend
- Consider caching navigation for high-traffic sites

## Troubleshooting

### Common Issues

**Migration fails**: Ensure user with ID 1 exists before running migration
**Slug conflicts**: System automatically appends numbers to ensure uniqueness
**Search not working**: Check that content is published and sections are active
**No admin access**: Verify user has `admin` or `master` role

### Logs and Debugging
- Check server logs for detailed error messages
- Use `/api/wiki/admin/stats` to verify system health
- Test public endpoints without authentication first 
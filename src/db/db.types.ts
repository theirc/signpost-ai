import type { ColumnType } from "kysely";

export type Decimal = ColumnType<string, number | string, number | string>;

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Json = ColumnType<JsonValue, string, string>;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Point = {
  x: number;
  y: number;
};

export interface _MigRegionsGeographicregion {
  code: string | null;
  hidden: number | null;
  id: number | null;
  languages_available: string | null;
  level: number | null;
  name: string | null;
  parent_id: number | null;
  restrict_access_to: string | null;
  site_id: number | null;
  slug: string | null;
  title_ar: string | null;
  title_de: string | null;
  title_el: string | null;
  title_en: string | null;
  title_es: string | null;
  title_fa: string | null;
  title_fr: string | null;
  title_ti: string | null;
  title_ur: string | null;
}

export interface _MigServicesProvider {
  additional_info: string;
  address_ar: string;
  address_de: string;
  address_el: string;
  address_en: string;
  address_es: string;
  address_fa: string;
  address_fr: string;
  address_ti: string;
  address_ur: string;
  contact_name: string | null;
  description_ar: string;
  description_de: string;
  description_el: string;
  description_en: string;
  description_es: string;
  description_fa: string;
  description_fr: string;
  description_ti: string;
  description_ur: string;
  facebook: string | null;
  focal_point_name_ar: string | null;
  focal_point_name_de: string | null;
  focal_point_name_el: string | null;
  focal_point_name_en: string | null;
  focal_point_name_es: string | null;
  focal_point_name_fa: string | null;
  focal_point_name_fr: string | null;
  focal_point_name_ti: string | null;
  focal_point_name_ur: string | null;
  focal_point_phone_number: string | null;
  id: number | null;
  is_frozen: number | null;
  meta_population: number | null;
  name_ar: string | null;
  name_de: string | null;
  name_el: string | null;
  name_en: string | null;
  name_es: string | null;
  name_fa: string | null;
  name_fr: string | null;
  name_ti: string | null;
  name_ur: string | null;
  number_of_monthly_beneficiaries: number | null;
  phone_number: string | null;
  record: string;
  region_id: number | null;
  requirement: string;
  title: string | null;
  twitter: string | null;
  type_id: number | null;
  user_id: number | null;
  vacancy: number | null;
  website: string | null;
}

export interface _MigServicesProvidertype {
  id: number | null;
  name_ar: string | null;
  name_de: string | null;
  name_el: string | null;
  name_en: string | null;
  name_es: string | null;
  name_fa: string | null;
  name_fr: string | null;
  name_ti: string | null;
  name_ur: string | null;
  number: number | null;
}

export interface _MigServicesService {
  additional_info_ar: string;
  additional_info_de: string;
  additional_info_el: string;
  additional_info_en: string;
  additional_info_es: string;
  additional_info_fa: string;
  additional_info_fr: string;
  additional_info_ti: string;
  additional_info_ur: string;
  address_ar: string | null;
  address_city_ar: string | null;
  address_city_de: string | null;
  address_city_el: string | null;
  address_city_en: string | null;
  address_city_es: string | null;
  address_city_fa: string | null;
  address_city_fr: string | null;
  address_city_ti: string | null;
  address_city_ur: string | null;
  address_de: string | null;
  address_el: string | null;
  address_en: string | null;
  address_es: string | null;
  address_fa: string | null;
  address_floor_ar: string | null;
  address_floor_de: string | null;
  address_floor_el: string | null;
  address_floor_en: string | null;
  address_floor_es: string | null;
  address_floor_fa: string | null;
  address_floor_fr: string | null;
  address_floor_ti: string | null;
  address_floor_ur: string | null;
  address_fr: string | null;
  address_in_country_language: string | null;
  address_ti: string | null;
  address_ur: string | null;
  confirmation_key: string | null;
  cost_of_service: string;
  created_at: Date | null;
  description_ar: string;
  description_de: string;
  description_el: string;
  description_en: string;
  description_es: string;
  description_fa: string;
  description_fr: string;
  description_ti: string;
  description_ur: string;
  email: string | null;
  exclude_from_confirmation: number | null;
  facebook_page: string | null;
  focal_point_email: string | null;
  focal_point_first_name: string | null;
  focal_point_last_name: string | null;
  focal_point_title: string | null;
  foreign_object_id: number | null;
  friday_close: string | null;
  friday_open: string | null;
  id: number | null;
  image: string | null;
  is_mobile: number | null;
  languages_spoken_ar: string;
  languages_spoken_de: string;
  languages_spoken_el: string;
  languages_spoken_en: string;
  languages_spoken_es: string;
  languages_spoken_fa: string;
  languages_spoken_fr: string;
  languages_spoken_ti: string;
  languages_spoken_ur: string;
  latitude: Decimal | null;
  location: string | null;
  longitude: Decimal | null;
  monday_close: string | null;
  monday_open: string | null;
  name_ar: string | null;
  name_de: string | null;
  name_el: string | null;
  name_en: string | null;
  name_es: string | null;
  name_fa: string | null;
  name_fr: string | null;
  name_ti: string | null;
  name_ur: string | null;
  newsletter_valid_emails: string | null;
  opening_time: string | null;
  phone_number: string | null;
  provider_id: number | null;
  region_id: number | null;
  saturday_close: string | null;
  saturday_open: string | null;
  second_focal_point_email: string | null;
  second_focal_point_first_name: string | null;
  second_focal_point_last_name: string | null;
  second_focal_point_title: string | null;
  slug: string | null;
  status: string | null;
  sunday_close: string | null;
  sunday_open: string | null;
  thursday_close: string | null;
  thursday_open: string | null;
  tuesday_close: string | null;
  tuesday_open: string | null;
  type_id: number | null;
  update_of_id: number | null;
  updated_at: Date | null;
  website: string | null;
  wednesday_close: string | null;
  wednesday_open: string | null;
  whatsapp: string | null;
}

export interface _MigServicesServicetype {
  color: string | null;
  comments_ar: string | null;
  comments_de: string | null;
  comments_el: string | null;
  comments_en: string | null;
  comments_es: string | null;
  comments_fa: string | null;
  comments_fr: string | null;
  comments_ti: string | null;
  comments_ur: string | null;
  icon: string | null;
  icon_url: string | null;
  id: number | null;
  name_ar: string | null;
  name_de: string | null;
  name_el: string | null;
  name_en: string | null;
  name_es: string | null;
  name_fa: string | null;
  name_fr: string | null;
  name_ti: string | null;
  name_ur: string | null;
  number: number | null;
  vector_icon: string | null;
}

export interface _MigServicesServiceTypes {
  id: number | null;
  service_id: number | null;
  servicetype_id: number | null;
}

export interface Accessibility {
  Accessibility_Name: string | null;
  date_updated: Date | null;
  Definition: string | null;
  id: Generated<number>;
  user_updated: string | null;
}

export interface AccessibilityTranslations {
  accessibility_id: number | null;
  Accessibility_Name: string | null;
  Definition: string | null;
  id: Generated<number>;
  languages_code: string | null;
}

export interface Agents {
  id: Generated<number>;
  title: string | null;
  type: string | null;
}

export interface AgentsWorkers {
  agents_id: number | null;
  id: Generated<number>;
  sort: number | null;
  workers_id: number | null;
}

export interface Ai {
  archived: number;
  channels: Json | null;
  country: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  distance: Decimal | null;
  enablehistory: Generated<number | null>;
  id: Generated<number>;
  ignoredefaultconstitutional: number | null;
  ignoredefaultprompt: number | null;
  kbtype: string | null;
  llm: string | null;
  maxresults: number | null;
  model: Generated<string | null>;
  modelclaude: Generated<string | null>;
  modelgemini: Generated<string | null>;
  modelollama: Generated<string | null>;
  prompt: string | null;
  solinum: number | null;
  temperature: Generated<Decimal | null>;
  title: string | null;
  user_created: string | null;
  user_updated: string | null;
  zddomain: string | null;
  zddomains: Json | null;
}

export interface AiAiExternalSources {
  ai_external_sources_id: number | null;
  ai_id: number | null;
  id: Generated<number>;
}

export interface AiAiSystemPrompts {
  ai_id: number | null;
  ai_system_prompts_id: number | null;
  id: Generated<number>;
}

export interface AiConstitutionalai {
  ai_id: number | null;
  constitutionalai_id: number | null;
  id: Generated<number>;
}

export interface AiCountriesN {
  ai_id: number | null;
  countries_n_id: number | null;
  id: Generated<number>;
}

export interface AiExternalSources {
  id: Generated<number>;
  status: Generated<string | null>;
  url: string | null;
}

export interface AiExternalSourcesFiles {
  ai_external_sources_id: number | null;
  directus_files_id: string | null;
  id: Generated<number>;
}

export interface Aischemas {
  field: string | null;
  id: Generated<number>;
  output: string | null;
  prompt: string | null;
  title: string | null;
  type: string | null;
}

export interface Aiscores {
  answer: string | null;
  bot: number | null;
  clientmetric: string | null;
  country: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  expected: string | null;
  failtype: Json | null;
  id: Generated<number>;
  jira: string | null;
  kbtype: string | null;
  logid: string | null;
  model: string | null;
  moderatorresponse: string | null;
  prompt: string | null;
  prompttype: string | null;
  qualitymetrics: Json | null;
  question: string | null;
  reporter: string | null;
  safetymetric: string | null;
  score: string | null;
  temperature: Decimal | null;
  traumametric: string | null;
  user_created: string | null;
  user_updated: string | null;
  zddomain: string | null;
}

export interface AiSystemPrompts {
  id: Generated<number>;
  systemconstitution: string | null;
}

export interface AiTranslations {
  ai_id: number | null;
  id: Generated<number>;
  languages_code: string | null;
}

export interface Articles {
  addHours: Json | null;
  address: string | null;
  alwaysopen: number | null;
  city: number | null;
  contactEmail: string | null;
  contactInfo: Json | null;
  contactLastName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
  country: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  description: string | null;
  Files: string | null;
  form: Json | null;
  headerimage: string | null;
  id: Generated<number>;
  lat: Decimal | null;
  location: Point | null;
  lon: Decimal | null;
  name: string | null;
  oldid: number | null;
  Physical_Location: number | null;
  provider: number | null;
  region: number | null;
  secondaryEmail: string | null;
  secondaryLastName: string | null;
  secondaryName: string | null;
  secondaryPhone: string | null;
  secondaryTitle: string | null;
  source: Generated<string | null>;
  status: Generated<string | null>;
  transifexstatus: number | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface ArticlesAccessibility {
  accessibility_id: number | null;
  articles_id: number | null;
  id: Generated<number>;
}

export interface ArticlesPopulations {
  articles_id: number | null;
  id: Generated<number>;
  populations_id: number | null;
}

export interface ArticlesServiceCategories {
  articles_id: number | null;
  id: Generated<number>;
  service_categories_id: number | null;
}

export interface ArticlesServicesSubcategories1 {
  articles_id: number | null;
  id: Generated<number>;
  services_subcategories_id: number | null;
}

export interface ArticlesTranslations1 {
  articles_id: number | null;
  description: string | null;
  id: Generated<number>;
  languages_id: string | null;
  name: string | null;
}

export interface Botlogs {
  answer: string | null;
  answer_constitutional: string | null;
  bot: number | null;
  date_created: Date | null;
  error: string | null;
  final_prompt: string | null;
  id: Generated<number>;
  perfconstitutional: Decimal | null;
  perfinit: Decimal | null;
  perfllmcall: Decimal | null;
  perfrouting: Decimal | null;
  perfsearch: string | null;
  router_isContact: number | null;
  router_language: string | null;
  router_location: string | null;
  router_searchTerms: string | null;
  search_results: string | null;
  user_message: string | null;
}

export interface Botsconfig {
  distance: Generated<Decimal | null>;
  id: Generated<number>;
  maxresults: Generated<number | null>;
  prompt: string | null;
}

export interface BotsconfigConstitutionalai {
  botsconfig_id: number | null;
  constitutionalai_id: number | null;
  id: Generated<number>;
}

export interface Cities {
  createdAt: Date;
  id: Generated<number>;
  isActive: Generated<number>;
  isHidden: number | null;
  lastSync: Date | null;
  name: string | null;
  regionId: number | null;
  slug: string | null;
  updatedAt: Date;
  zendeskId: string | null;
}

export interface CitiesN {
  country: number | null;
  id: Generated<number>;
  name: string | null;
  oldid: number | null;
  region: number | null;
}

export interface CitiesNTranslations {
  cities_n_id: number | null;
  id: Generated<number>;
  languages_code: string | null;
  name: string | null;
}

export interface CityI18ns {
  cityId: number | null;
  id: Generated<number>;
  language: string | null;
  lastSync: Date | null;
  name: string | null;
  zendeskid: string | null;
}

export interface Constitutionalai {
  critique: string | null;
  date_created: Date | null;
  date_updated: Date | null;
  id: Generated<number>;
  revision: string | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface Countries {
  ampmEnabled: number | null;
  boxFolderId: string | null;
  createdAt: Date;
  hasAddressInOwnLanguage: number | null;
  id: Generated<number>;
  instanceId: number | null;
  isActive: Generated<number>;
  isHidden: number | null;
  languages: string | null;
  locale: string | null;
  name: string | null;
  permissionGroupId: string | null;
  preferredLanguage: string | null;
  slug: string | null;
  transifexProject: string | null;
  transifexSync: number | null;
  updatedAt: Date;
  zendeskCategoryId: string | null;
  zendeskDefaultSectionId: string | null;
  zendeskSync: Generated<number | null>;
  zendeskUrl: string | null;
}

export interface CountriesN {
  country_id: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  id: Generated<number>;
  instance: number | null;
  language: string | null;
  name: string | null;
  oldid: number | null;
  preview: string | null;
  production: string | null;
  site: string | null;
  transifex_project: string | null;
  user_created: string | null;
  user_updated: string | null;
  zendesk_category: number | null;
  zendesk_url: string | null;
}

export interface CountriesNLanguages {
  countries_n_id: number | null;
  id: Generated<number>;
  languages_code: string | null;
}

export interface CountriesNPagecontent {
  countries_n_id: number | null;
  id: Generated<number>;
  pagecontent_id: number | null;
  sort: number | null;
}

export interface CountriesNTranslations4 {
  countries_n_id: number | null;
  id: Generated<number>;
  languages_code: string | null;
  name: string | null;
}

export interface CountryI18ns {
  countryId: number | null;
  id: Generated<number>;
  language: string | null;
  name: string | null;
}

export interface DirectusActivity {
  action: string;
  collection: string;
  comment: string | null;
  id: Generated<number>;
  ip: string | null;
  item: string;
  origin: string | null;
  timestamp: Generated<Date>;
  user: string | null;
  user_agent: string | null;
}

export interface DirectusCollections {
  accountability: Generated<string | null>;
  archive_app_filter: Generated<number>;
  archive_field: string | null;
  archive_value: string | null;
  collapse: Generated<string>;
  collection: string;
  color: string | null;
  display_template: string | null;
  group: string | null;
  hidden: Generated<number>;
  icon: string | null;
  item_duplication_fields: Json | null;
  note: string | null;
  preview_url: string | null;
  singleton: Generated<number>;
  sort: number | null;
  sort_field: string | null;
  translations: Json | null;
  unarchive_value: string | null;
  versioning: Generated<number>;
}

export interface DirectusDashboards {
  color: string | null;
  date_created: Generated<Date | null>;
  icon: Generated<string>;
  id: string;
  name: string;
  note: string | null;
  user_created: string | null;
}

export interface DirectusExtensions {
  bundle: string | null;
  enabled: Generated<number>;
  folder: string;
  id: string;
  source: string;
}

export interface DirectusFields {
  collection: string;
  conditions: Json | null;
  display: string | null;
  display_options: Json | null;
  field: string;
  group: string | null;
  hidden: Generated<number>;
  id: Generated<number>;
  interface: string | null;
  note: string | null;
  options: Json | null;
  readonly: Generated<number>;
  required: Generated<number | null>;
  sort: number | null;
  special: string | null;
  translations: Json | null;
  validation: Json | null;
  validation_message: string | null;
  width: Generated<string | null>;
}

export interface DirectusFiles {
  charset: string | null;
  description: string | null;
  duration: number | null;
  embed: string | null;
  filename_disk: string | null;
  filename_download: string;
  filesize: number | null;
  focal_point_x: number | null;
  focal_point_y: number | null;
  folder: string | null;
  height: number | null;
  id: string;
  location: string | null;
  metadata: Json | null;
  modified_by: string | null;
  modified_on: Generated<Date>;
  storage: string;
  tags: string | null;
  title: string | null;
  tus_data: Json | null;
  tus_id: string | null;
  type: string | null;
  uploaded_by: string | null;
  uploaded_on: Generated<Date>;
  width: number | null;
}

export interface DirectusFlows {
  accountability: Generated<string | null>;
  color: string | null;
  date_created: Generated<Date | null>;
  description: string | null;
  icon: string | null;
  id: string;
  name: string;
  operation: string | null;
  options: Json | null;
  status: Generated<string>;
  trigger: string | null;
  user_created: string | null;
}

export interface DirectusFolders {
  id: string;
  name: string;
  parent: string | null;
}

export interface DirectusMigrations {
  name: string;
  timestamp: Generated<Date | null>;
  version: string;
}

export interface DirectusNotifications {
  collection: string | null;
  id: Generated<number>;
  item: string | null;
  message: string | null;
  recipient: string;
  sender: string | null;
  status: Generated<string | null>;
  subject: string;
  timestamp: Generated<Date | null>;
}

export interface DirectusOperations {
  date_created: Generated<Date | null>;
  flow: string;
  id: string;
  key: string;
  name: string | null;
  options: Json | null;
  position_x: number;
  position_y: number;
  reject: string | null;
  resolve: string | null;
  type: string;
  user_created: string | null;
}

export interface DirectusPanels {
  color: string | null;
  dashboard: string;
  date_created: Generated<Date | null>;
  height: number;
  icon: string | null;
  id: string;
  name: string | null;
  note: string | null;
  options: Json | null;
  position_x: number;
  position_y: number;
  show_header: Generated<number>;
  type: string;
  user_created: string | null;
  width: number;
}

export interface DirectusPermissions {
  action: string;
  collection: string;
  fields: string | null;
  id: Generated<number>;
  permissions: Json | null;
  presets: Json | null;
  role: string | null;
  validation: Json | null;
}

export interface DirectusPresets {
  bookmark: string | null;
  collection: string | null;
  color: string | null;
  filter: Json | null;
  icon: Generated<string | null>;
  id: Generated<number>;
  layout: Generated<string | null>;
  layout_options: Json | null;
  layout_query: Json | null;
  refresh_interval: number | null;
  role: string | null;
  search: string | null;
  user: string | null;
}

export interface DirectusRelations {
  id: Generated<number>;
  junction_field: string | null;
  many_collection: string;
  many_field: string;
  one_allowed_collections: string | null;
  one_collection: string | null;
  one_collection_field: string | null;
  one_deselect_action: Generated<string>;
  one_field: string | null;
  sort_field: string | null;
}

export interface DirectusRevisions {
  activity: number;
  collection: string;
  data: Json | null;
  delta: Json | null;
  id: Generated<number>;
  item: string;
  parent: number | null;
  version: string | null;
}

export interface DirectusRoles {
  admin_access: Generated<number>;
  app_access: Generated<number>;
  description: string | null;
  enforce_tfa: Generated<number>;
  icon: Generated<string>;
  id: string;
  ip_access: string | null;
  name: string;
}

export interface DirectusSessions {
  expires: Date;
  ip: string | null;
  next_token: string | null;
  origin: string | null;
  share: string | null;
  token: string;
  user: string | null;
  user_agent: string | null;
}

export interface DirectusSettings {
  auth_login_attempts: Generated<number | null>;
  auth_password_policy: string | null;
  basemaps: Json | null;
  custom_aspect_ratios: Json | null;
  custom_css: string | null;
  default_appearance: Generated<string>;
  default_language: Generated<string>;
  default_theme_dark: string | null;
  default_theme_light: string | null;
  id: Generated<number>;
  mapbox_key: string | null;
  module_bar: Json | null;
  project_color: Generated<string>;
  project_descriptor: string | null;
  project_logo: string | null;
  project_name: Generated<string>;
  project_url: string | null;
  public_background: string | null;
  public_favicon: string | null;
  public_foreground: string | null;
  public_note: string | null;
  public_registration: Generated<number>;
  public_registration_email_filter: Json | null;
  public_registration_role: string | null;
  public_registration_verify_email: Generated<number>;
  report_bug_url: string | null;
  report_error_url: string | null;
  report_feature_url: string | null;
  storage_asset_presets: Json | null;
  storage_asset_transform: Generated<string | null>;
  storage_default_folder: string | null;
  theme_dark_overrides: Json | null;
  theme_light_overrides: Json | null;
  translation_strings: Json | null;
}

export interface DirectusShares {
  collection: string;
  date_created: Generated<Date | null>;
  date_end: Date | null;
  date_start: Date | null;
  id: string;
  item: string;
  max_uses: number | null;
  name: string | null;
  password: string | null;
  role: string | null;
  times_used: Generated<number | null>;
  user_created: string | null;
}

export interface DirectusTranslations {
  id: string;
  key: string;
  language: string;
  value: string;
}

export interface DirectusUsers {
  appearance: string | null;
  auth_data: Json | null;
  avatar: string | null;
  description: string | null;
  email: string | null;
  email_notifications: Generated<number | null>;
  external_identifier: string | null;
  first_name: string | null;
  id: string;
  language: string | null;
  last_access: Date | null;
  last_name: string | null;
  last_page: string | null;
  location: string | null;
  password: string | null;
  provider: Generated<string>;
  role: string | null;
  status: Generated<string>;
  tags: Json | null;
  tfa_secret: string | null;
  theme_dark: string | null;
  theme_dark_overrides: Json | null;
  theme_light: string | null;
  theme_light_overrides: Json | null;
  title: string | null;
  token: string | null;
}

export interface DirectusVersions {
  collection: string;
  date_created: Generated<Date | null>;
  date_updated: Generated<Date | null>;
  hash: string | null;
  id: string;
  item: string;
  key: string;
  name: string | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface DirectusWebhooks {
  actions: string;
  collections: string;
  data: Generated<number>;
  headers: Json | null;
  id: Generated<number>;
  method: Generated<string>;
  migrated_flow: string | null;
  name: string;
  status: Generated<string>;
  url: string;
  was_active_before_deprecation: Generated<number>;
}

export interface DmsPersistentObjects {
  ACTIVITY_ID: string;
  CREATE_ORDER: number | null;
  CREATE_STMT: string;
  DB_NAME: string;
  OBJ_NAME: string;
  OBJ_TYPE: string;
  TABLE_NAME: string;
}

export interface Files {
  createdAt: Date | null;
  fileURL: string | null;
  id: Generated<number>;
  serviceId: number;
  updatedAt: Date | null;
}

export interface Footerlinks {
  id: Generated<number>;
  title: string | null;
  url: string | null;
}

export interface FooterlinksTranslations {
  footerlinks_id: number | null;
  id: Generated<number>;
  languages_code: string | null;
  title: string | null;
}

export interface Headerlinks {
  date_created: Date | null;
  date_updated: Date | null;
  id: Generated<number>;
  link: string | null;
  title: string | null;
  type: string | null;
  user_updated: string | null;
}

export interface HeaderlinksHeaderlinks {
  headerlinks_id: number | null;
  id: Generated<number>;
  related_headerlinks_id: number | null;
  sort: number | null;
}

export interface HeaderlinksTranslations {
  headerlinks_id: number | null;
  id: Generated<number>;
  languages_code: string | null;
  title: string | null;
}

export interface Instances {
  createdAt: Date;
  id: Generated<number>;
  isActive: Generated<number>;
  name: string | null;
  slug: string | null;
  status: string | null;
  theme: string | null;
  updatedAt: Date;
}

export interface InstancesN {
  date_created: Date | null;
  date_updated: Date | null;
  id: Generated<number>;
  name: string | null;
  oldid: number | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface JunctionDirectusUsersCountriesN {
  countries_n_id: number | null;
  directus_users_id: string | null;
  id: Generated<number>;
}

export interface Languages {
  code: string;
  direction: Generated<string | null>;
  name: string | null;
  sort: number | null;
}

export interface Pagecontent {
  about_description: string | null;
  about_image: string | null;
  about_title: string | null;
  bgcolor: string | null;
  categories_subtitle: string | null;
  categories_title: string | null;
  channelstitle: Generated<string | null>;
  channelsubtitle: Generated<string | null>;
  colorbg: string | null;
  colortext: string | null;
  components: Json | null;
  components_details: Json | null;
  date_created: Date | null;
  date_updated: Date | null;
  email: Generated<string | null>;
  email_link: string | null;
  fb: Generated<string | null>;
  fb_link: string | null;
  fbmess: Generated<string | null>;
  fbmess_link: string | null;
  fontweight: Generated<number | null>;
  footertext: Generated<string | null>;
  id: Generated<number>;
  image: string | null;
  info_subtitle: string | null;
  info_title: Generated<string | null>;
  instagram: Generated<string | null>;
  instagram_link: string | null;
  richtext: string | null;
  sections_subtitle: string | null;
  sections_title: string | null;
  services_subtitle: Generated<string | null>;
  services_title: Generated<string | null>;
  statement_title: string | null;
  telegram: Generated<string | null>;
  telegram_link: string | null;
  text: string | null;
  text_accesibility: Generated<string | null>;
  text_populations: Generated<string | null>;
  text_providers: Generated<string | null>;
  text_typeofservice: Generated<string | null>;
  textbold: Generated<number | null>;
  textcolor: string | null;
  textsize: Generated<number | null>;
  tiktok_link: string | null;
  title: string | null;
  toktok: Generated<string | null>;
  type: string | null;
  user_created: string | null;
  user_updated: string | null;
  whatsapp: Generated<string | null>;
  whatsapp_link: string | null;
  whatsappc: Generated<string | null>;
  whatsappc_link: string | null;
}

export interface PagecontentFooterlinks {
  footerlinks_id: number | null;
  id: Generated<number>;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
  text: string | null;
}

export interface PagecontentTranslations1 {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
  richtext: string | null;
}

export interface PagecontentTranslations10 {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations11 {
  about_description: string | null;
  about_title: string | null;
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations2 {
  channelstitle: string | null;
  channelsubtitle: string | null;
  email: string | null;
  fb: string | null;
  fbmess: string | null;
  id: Generated<number>;
  instagram: string | null;
  languages_code: string | null;
  pagecontent_id: number | null;
  telegram: string | null;
  toktok: string | null;
  whatsapp: string | null;
  whatsappc: string | null;
}

export interface PagecontentTranslations3 {
  footertext: string | null;
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations4 {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
  services_subtitle: string | null;
  services_title: string | null;
  text_accesibility: string | null;
  text_populations: string | null;
  text_providers: string | null;
  text_typeofservice: string | null;
}

export interface PagecontentTranslations5 {
  id: Generated<number>;
  info_subtitle: string | null;
  info_title: string | null;
  languages_code: string | null;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations6 {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations7 {
  categories_subtitle: string | null;
  categories_title: string | null;
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
}

export interface PagecontentTranslations8 {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
  sections_subtitle: string | null;
  sections_title: string | null;
}

export interface PagecontentTranslations9 {
  id: Generated<number>;
  languages_code: string | null;
  pagecontent_id: number | null;
  statement_title: string | null;
}

export interface Populations {
  Definition: string | null;
  id: Generated<number>;
  Population_Served: string | null;
  Visible: number | null;
}

export interface PopulationsTranslations2 {
  Definition: string | null;
  id: Generated<number>;
  languages_code: string | null;
  populations_id: number | null;
  Populations_Served: string | null;
}

export interface Providercategories {
  countryId: number | null;
  createdAt: Date | null;
  id: Generated<number>;
  instanceId: number | null;
  isActive: Generated<number>;
  name: Generated<string | null>;
  slug: string | null;
  updatedAt: Date | null;
}

export interface ProviderCategoriesN {
  country: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  Description: string | null;
  id: Generated<number>;
  name: string | null;
  oldid: number | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface ProviderCategoriesNTranslations {
  Definition: string | null;
  id: Generated<number>;
  languages_code: string | null;
  name: string | null;
  provider_categories_n_id: number | null;
}

export interface ProvidercategoryI18ns {
  id: Generated<number>;
  language: string | null;
  name: Generated<string | null>;
  providerCategoryId: number | null;
}

export interface ProviderI18ns {
  address: Generated<string | null>;
  createdAt: Date | null;
  description: string | null;
  id: Generated<number>;
  language: string | null;
  name: Generated<string | null>;
  providerId: number | null;
  updatedAt: Date | null;
}

export interface Providers {
  additionalInformation: string | null;
  contactName: string | null;
  countryId: number | null;
  createdAt: Date | null;
  email: string | null;
  facebook: Generated<string | null>;
  freezeProvider: number | null;
  id: Generated<number>;
  instagram: string | null;
  isActive: number | null;
  name: Generated<string | null>;
  phone: string | null;
  providerCategoryId: number | null;
  requirements: string | null;
  slug: string | null;
  title: string | null;
  twitter: Generated<string | null>;
  updatedAt: Date | null;
  vacancy: number | null;
  website: Generated<string | null>;
  whatsapp: string | null;
}

export interface ProvidersN {
  address: string | null;
  category: number | null;
  country: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  description: string | null;
  expiration: Date | null;
  id: Generated<number>;
  name: string | null;
  oldid: number | null;
  status: string | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface ProvidersNTranslations1 {
  description: string | null;
  id: Generated<number>;
  languages_code: string | null;
  name: string | null;
  providers_n_id: number | null;
}

export interface RegionI18ns {
  id: Generated<number>;
  language: string | null;
  lastSync: Date | null;
  name: string | null;
  regionId: number | null;
  zendeskid: string | null;
}

export interface Regions {
  countryId: number | null;
  createdAt: Date;
  id: Generated<number>;
  isActive: Generated<number>;
  isHidden: number | null;
  lastSync: Date | null;
  name: string | null;
  slug: string | null;
  updatedAt: Date;
  zendeskId: string | null;
}

export interface RegionsN {
  country: number | null;
  id: Generated<number>;
  name: string | null;
  oldid: number | null;
}

export interface RegionsNTranslations {
  id: Generated<number>;
  languages_code: string | null;
  name: string | null;
  regions_n_id: number | null;
}

export interface Servicecategories {
  color: string | null;
  comments: string | null;
  countryId: number | null;
  createdAt: Date | null;
  icon: string | null;
  id: Generated<number>;
  isActive: Generated<number>;
  name: string | null;
  slug: string | null;
  updatedAt: Date | null;
}

export interface ServiceCategories {
  Color: string | null;
  date_created: Date | null;
  date_updated: Date | null;
  Description: string | null;
  Icon: string | null;
  id: Generated<number>;
  Name: string | null;
  sort: number | null;
  status: Generated<string | null>;
  user_created: string | null;
  user_updated: string | null;
}

export interface ServiceCategoriesTranslations1 {
  Description: string | null;
  id: Generated<number>;
  languages_code: string | null;
  Name: string | null;
  service_categories_id: number | null;
}

export interface ServicecategoryI18ns {
  id: Generated<number>;
  language: string | null;
  name: string | null;
  serviceCategoryId: number | null;
}

export interface Servicecontactinformation {
  createdAt: Date | null;
  id: Generated<number>;
  serviceId: number;
  type: string;
  updatedAt: Date | null;
  value: string;
}

export interface Servicecontactinformationtype {
  type: string;
  validator: Generated<string | null>;
}

export interface Servicedocumentlink {
  createdAt: Generated<Date>;
  id: Generated<number>;
  name: string;
  serviceId: number;
  updatedAt: Generated<Date>;
  url: string;
}

export interface ServiceI18ns {
  additionalInformation: string | null;
  address: string | null;
  createdAt: Date | null;
  description: string | null;
  id: Generated<number>;
  language: string | null;
  languagesSpoken: string | null;
  lastSync: Date | null;
  name: string | null;
  serviceId: number | null;
  updatedAt: Date | null;
  zendeskId: string | null;
}

export interface Serviceopeninghours {
  close: string | null;
  createdAt: Date | null;
  day: number | null;
  id: Generated<number>;
  open: string | null;
  serviceId: number | null;
  updatedAt: Date | null;
}

export interface Services {
  additionalInformation: string | null;
  address: string | null;
  cityId: number | null;
  contactEmail: Generated<string | null>;
  contactLastName: Generated<string | null>;
  contactName: Generated<string | null>;
  contactPhone: string | null;
  contactTitle: Generated<string | null>;
  costOfService: string | null;
  countryId: number | null;
  createdAt: Date | null;
  description: string | null;
  email: Generated<string | null>;
  facebook: Generated<string | null>;
  id: Generated<number>;
  image: Generated<string | null>;
  instagram: Generated<string | null>;
  isAlwaysOpen: Generated<number | null>;
  languagesSpoken: string | null;
  lastSync: Date | null;
  latitude: Decimal | null;
  localAddress: string | null;
  location: string | null;
  longitude: Decimal | null;
  name: string;
  phone: Generated<string | null>;
  previewLink: Generated<string | null>;
  providerId: number | null;
  regionId: number | null;
  secondaryAddress: Generated<string | null>;
  secondaryEmail: Generated<string | null>;
  secondaryLastName: Generated<string | null>;
  secondaryName: Generated<string | null>;
  secondaryPhone: Generated<string | null>;
  secondaryTitle: Generated<string | null>;
  slug: string;
  status: string;
  tags: Generated<string | null>;
  twitter: Generated<string | null>;
  updatedAt: Date | null;
  website: Generated<string | null>;
  whatsapp: Generated<string | null>;
  zendeskId: string | null;
}

export interface ServicesCategories {
  createdAt: Date | null;
  id: Generated<number>;
  serviceCategoryId: number | null;
  serviceId: number | null;
  updatedAt: Date | null;
}

export interface ServicesSubcategories {
  description: string | null;
  id: Generated<number>;
  name: string | null;
}

export interface ServicesSubcategoriesServiceCategories1 {
  id: Generated<number>;
  service_categories_id: number | null;
  services_subcategories_id: number | null;
}

export interface ServicesSubcategoriesTranslations {
  Definition: string | null;
  id: Generated<number>;
  languages_code: string | null;
  name: string | null;
  other_categories: string | null;
  services_subcategories_id: number | null;
}

export interface Siteconfig {
  country: number | null;
  date_created: Date | null;
  date_updated: Date | null;
  headerbgcolor: string | null;
  headercolor: string | null;
  headercolorbg: string | null;
  headercolortxt: string | null;
  id: string;
  pagebgcolor: string | null;
  pagecolor: string | null;
  pagecolorbg: string | null;
  pagecolortxt: string | null;
  title: string | null;
  user_created: string | null;
  user_updated: string | null;
}

export interface SiteconfigHeaderlinks {
  headerlinks_id: number | null;
  id: Generated<number>;
  siteconfig_id: string | null;
}

export interface SiteconfigHeaderlinks1 {
  headerlinks_id: number | null;
  id: Generated<number>;
  siteconfig_id: string | null;
  sort: number | null;
}

export interface SiteconfigPagecontent {
  id: Generated<number>;
  pagecontent_id: number | null;
  siteconfig_id: string | null;
  sort: number | null;
}

export interface SiteconfigPagecontent1 {
  id: Generated<number>;
  pagecontent_id: number | null;
  siteconfig_id: string | null;
  sort: number | null;
}

export interface Synclogs {
  date: Date | null;
  error: string | null;
  id: Generated<number>;
  instance: number | null;
  locale: string | null;
  message: string | null;
  reference: number | null;
  status: number | null;
  title: string | null;
  type: number | null;
  zendesk: string | null;
}

export interface Test {
  id: Generated<number>;
  name: string | null;
  subcat: Json | null;
  type: Json | null;
}

export interface Twilio {
  id: Generated<number>;
  message: string | null;
  phone: string | null;
  to_phone: string | null;
}

export interface Users {
  createdAt: Date;
  email: string;
  id: Generated<number>;
  instanceId: number | null;
  isActive: number | null;
  isIRCMember: number | null;
  language: Generated<string>;
  lastName: string | null;
  name: string | null;
  password: string | null;
  role: string | null;
  timeout: Generated<number>;
  toggleIds: Generated<number>;
  updatedAt: Date;
}

export interface Workers {
  id: Generated<number>;
  output_action: string | null;
  outputpromptprefix: string | null;
  outputpromptsuffix: string | null;
  outputtype: string | null;
  outputvariable: string | null;
  title: string | null;
  type: string | null;
}

export interface WorkersAischemas {
  aischemas_id: number | null;
  id: Generated<number>;
  workers_id: number | null;
}

export interface ZendeskArticlesToDelete {
  countryId: number | null;
  zendeskId: string | null;
}

export interface DB {
  _mig_regions_geographicregion: _MigRegionsGeographicregion;
  _mig_services_provider: _MigServicesProvider;
  _mig_services_providertype: _MigServicesProvidertype;
  _mig_services_service: _MigServicesService;
  _mig_services_service_types: _MigServicesServiceTypes;
  _mig_services_servicetype: _MigServicesServicetype;
  accessibility: Accessibility;
  accessibility_translations: AccessibilityTranslations;
  agents: Agents;
  agents_workers: AgentsWorkers;
  ai: Ai;
  ai_ai_external_sources: AiAiExternalSources;
  ai_ai_system_prompts: AiAiSystemPrompts;
  ai_constitutionalai: AiConstitutionalai;
  ai_countries_n: AiCountriesN;
  ai_external_sources: AiExternalSources;
  ai_external_sources_files: AiExternalSourcesFiles;
  ai_system_prompts: AiSystemPrompts;
  ai_translations: AiTranslations;
  aischemas: Aischemas;
  aiscores: Aiscores;
  articles: Articles;
  articles_accessibility: ArticlesAccessibility;
  articles_populations: ArticlesPopulations;
  articles_service_categories: ArticlesServiceCategories;
  articles_services_subcategories_1: ArticlesServicesSubcategories1;
  articles_translations_1: ArticlesTranslations1;
  botlogs: Botlogs;
  botsconfig: Botsconfig;
  botsconfig_constitutionalai: BotsconfigConstitutionalai;
  cities: Cities;
  cities_n: CitiesN;
  cities_n_translations: CitiesNTranslations;
  city_i18ns: CityI18ns;
  constitutionalai: Constitutionalai;
  countries: Countries;
  countries_n: CountriesN;
  countries_n_languages: CountriesNLanguages;
  countries_n_pagecontent: CountriesNPagecontent;
  countries_n_translations_4: CountriesNTranslations4;
  country_i18ns: CountryI18ns;
  directus_activity: DirectusActivity;
  directus_collections: DirectusCollections;
  directus_dashboards: DirectusDashboards;
  directus_extensions: DirectusExtensions;
  directus_fields: DirectusFields;
  directus_files: DirectusFiles;
  directus_flows: DirectusFlows;
  directus_folders: DirectusFolders;
  directus_migrations: DirectusMigrations;
  directus_notifications: DirectusNotifications;
  directus_operations: DirectusOperations;
  directus_panels: DirectusPanels;
  directus_permissions: DirectusPermissions;
  directus_presets: DirectusPresets;
  directus_relations: DirectusRelations;
  directus_revisions: DirectusRevisions;
  directus_roles: DirectusRoles;
  directus_sessions: DirectusSessions;
  directus_settings: DirectusSettings;
  directus_shares: DirectusShares;
  directus_translations: DirectusTranslations;
  directus_users: DirectusUsers;
  directus_versions: DirectusVersions;
  directus_webhooks: DirectusWebhooks;
  dms_persistent_objects: DmsPersistentObjects;
  files: Files;
  footerlinks: Footerlinks;
  footerlinks_translations: FooterlinksTranslations;
  headerlinks: Headerlinks;
  headerlinks_headerlinks: HeaderlinksHeaderlinks;
  headerlinks_translations: HeaderlinksTranslations;
  instances: Instances;
  instances_n: InstancesN;
  junction_directus_users_countries_n: JunctionDirectusUsersCountriesN;
  languages: Languages;
  pagecontent: Pagecontent;
  pagecontent_footerlinks: PagecontentFooterlinks;
  pagecontent_translations: PagecontentTranslations;
  pagecontent_translations_1: PagecontentTranslations1;
  pagecontent_translations_10: PagecontentTranslations10;
  pagecontent_translations_11: PagecontentTranslations11;
  pagecontent_translations_2: PagecontentTranslations2;
  pagecontent_translations_3: PagecontentTranslations3;
  pagecontent_translations_4: PagecontentTranslations4;
  pagecontent_translations_5: PagecontentTranslations5;
  pagecontent_translations_6: PagecontentTranslations6;
  pagecontent_translations_7: PagecontentTranslations7;
  pagecontent_translations_8: PagecontentTranslations8;
  pagecontent_translations_9: PagecontentTranslations9;
  populations: Populations;
  populations_translations_2: PopulationsTranslations2;
  provider_categories_n: ProviderCategoriesN;
  provider_categories_n_translations: ProviderCategoriesNTranslations;
  provider_i18ns: ProviderI18ns;
  providercategories: Providercategories;
  providercategory_i18ns: ProvidercategoryI18ns;
  providers: Providers;
  providers_n: ProvidersN;
  providers_n_translations_1: ProvidersNTranslations1;
  region_i18ns: RegionI18ns;
  regions: Regions;
  regions_n: RegionsN;
  regions_n_translations: RegionsNTranslations;
  service_categories: ServiceCategories;
  service_categories_translations_1: ServiceCategoriesTranslations1;
  service_i18ns: ServiceI18ns;
  servicecategories: Servicecategories;
  servicecategory_i18ns: ServicecategoryI18ns;
  servicecontactinformation: Servicecontactinformation;
  servicecontactinformationtype: Servicecontactinformationtype;
  servicedocumentlink: Servicedocumentlink;
  serviceopeninghours: Serviceopeninghours;
  services: Services;
  services_categories: ServicesCategories;
  services_subcategories: ServicesSubcategories;
  services_subcategories_service_categories_1: ServicesSubcategoriesServiceCategories1;
  services_subcategories_translations: ServicesSubcategoriesTranslations;
  siteconfig: Siteconfig;
  siteconfig_headerlinks: SiteconfigHeaderlinks;
  siteconfig_headerlinks_1: SiteconfigHeaderlinks1;
  siteconfig_pagecontent: SiteconfigPagecontent;
  siteconfig_pagecontent_1: SiteconfigPagecontent1;
  synclogs: Synclogs;
  test: Test;
  twilio: Twilio;
  users: Users;
  workers: Workers;
  workers_aischemas: WorkersAischemas;
  zendesk_articles_to_delete: ZendeskArticlesToDelete;
}

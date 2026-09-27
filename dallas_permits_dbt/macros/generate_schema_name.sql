-- By default dbt names custom schemas '<target_schema>_<custom>' (e.g. STAGING_MARTS).
-- Override so a model configured with +schema: MARTS lands in exactly MARTS.
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
